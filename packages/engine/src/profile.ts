import { randomBot, type Bot } from "./match";
import { resolveParams } from "./params";
import { createRng } from "./rng";
import { simulate } from "./sim";
import type { GameModule, Params, PlayerId } from "./types";

/**
 * A game's profile on Board Game Arena's four axes (complexity, strategy, luck, interaction),
 * measured by playing it instead of asking players to vote. Every score from 1 to 5 comes with the
 * measurements behind it, so the table can say why a game rates the way it does.
 */

export interface ProfileMeasures {
  /** Random games played to take the measurements below. */
  games: number;
  /** Distinct kinds of move seen: the "type" of object moves together with the fields they carry. */
  moveKinds: number;
  /** Mean number of legal moves a player chooses from. */
  choices: number;
  /** Share of moves where the player had more than one option. */
  choiceRate: number;
  /** Resources, kinds of card and kinds of board space the table shows. */
  components: number;
  /** Whether the opening position changes with the shuffle or roll. */
  setupChance: boolean;
  /** Share of moves whose result depends on chance (a die roll, a reshuffle, a random draw). */
  chanceRate: number;
  /** Share of moves that change what a rival holds: resources, cards, pieces or score. */
  directRate: number;
  /** Share of moves that change what everyone shares: claiming board space, taking from a common row. */
  sharedRate: number;
  /** Seats in the measured games. */
  numPlayers: number;
  /** Share of games the planner wins against random players, over every seat. */
  plannerWinRate?: number;
  /** That win rate rescaled so 0 is the fair share and 1 always winning. */
  skillEdge?: number;
}

export interface GameProfile {
  complexity: number;
  /** Left out when no planner was measured, e.g. in bluffing games where planning ahead is not the skill. */
  strategy?: number;
  luck: number;
  interaction: number;
  measures: ProfileMeasures;
}

export interface ProfileOptions {
  numPlayers?: number;
  params?: Params;
  /** Random games for the complexity, luck and interaction measurements. */
  games?: number;
  /** A bot that plans; with plannerGames > 0 it takes each seat in turn against random players. */
  planner?: Bot;
  plannerGames?: number;
  maxTurns?: number;
  /** Called before each simulated game (progress, watchdog heartbeats). */
  onGame?(seed: number): void;
}

/** "place(card,space)": a move's type with the fields it carries, so moves of one type that do different things count apart. */
const kindOf = (move: unknown): string => {
  if (move === null || typeof move !== "object") return typeof move;
  const { type, ...fields } = move as Record<string, unknown>;
  return `${String(type)}(${Object.keys(fields).sort().join(",")})`;
};

function safely<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** What each seat holds and what the table shares, as comparable signatures. */
interface Snapshot {
  seats: Map<PlayerId, string>;
  shared: string;
  /** Board cells and pieces by id: owner and signature. */
  things: Map<string, { owner?: PlayerId; sig: string }>;
}

function snapshot(game: GameModule, state: unknown): Snapshot {
  const seats = new Map<PlayerId, string>();
  const shared: string[] = [];
  for (const panel of safely(() => game.panels?.(state, undefined) ?? [], [])) {
    const sig = JSON.stringify([panel.counters?.map((c) => [c.id, c.value]), panel.cards?.map((c) => c.id), panel.note]);
    if (panel.zone === "players" && panel.owner !== undefined) seats.set(panel.owner, (seats.get(panel.owner) ?? "") + sig);
    else if (panel.zone === "shared") shared.push(sig);
  }
  const things = new Map<string, { owner?: PlayerId; sig: string }>();
  const geometry = safely(() => game.geometry?.(state, undefined), undefined);
  for (const cell of geometry?.cells ?? []) {
    // Text-only cells carry public state such as the standing bid; other cells' names are fixed.
    const sig = cell.kind === "label" ? cell.label : JSON.stringify([cell.owner, cell.kind, cell.segments]);
    things.set(`cell:${cell.id}`, { owner: cell.owner, sig: sig ?? "" });
  }
  for (const piece of geometry?.pieces ?? []) {
    things.set(`piece:${piece.id}`, { owner: piece.owner, sig: JSON.stringify([piece.owner, piece.x, piece.y, piece.label]) });
  }
  return { seats, shared: shared.join("|"), things };
}

/**
 * How a move by `mover` touched the others. Direct: a rival's resources, cards or score changed,
 * or a rival's piece moved, changed hands or left the board. Shared: a shared row or supply
 * changed, or a board space was claimed (a piece placed, an empty space taken).
 */
function touched(before: Snapshot, after: Snapshot, mover: PlayerId): { direct: boolean; shared: boolean } {
  let direct = [...before.seats].some(([seat, sig]) => seat !== mover && after.seats.get(seat) !== sig);
  let shared = before.shared !== after.shared;
  for (const id of new Set([...before.things.keys(), ...after.things.keys()])) {
    const was = before.things.get(id);
    const now = after.things.get(id);
    if (was?.sig === now?.sig) continue;
    const rival = (owner?: PlayerId) => owner !== undefined && owner !== mover;
    if (rival(was?.owner) || rival(now?.owner)) direct = true;
    // A piece of the mover's that only moved along is not interaction; a newly claimed space is.
    else if (!(was && was.owner === mover && now?.owner === mover && id.startsWith("piece:"))) shared = true;
  }
  return { direct, shared };
}

/** Distinct card kinds: titles without their copy or serial numbers ("Voyage 23" and "Voyage 9" are one). */
const cardKind = (title: string) => title.replace(/[\s#-]*\d+[a-z]?$/i, "").trim();

/** The measurements, from `games` random games and optional planner games. */
export function measureProfile(game: GameModule, opts: ProfileOptions = {}): ProfileMeasures {
  const numPlayers = opts.numPlayers ?? Math.min(game.meta.maxPlayers, Math.max(game.meta.minPlayers, 3));
  const params = opts.params ?? resolveParams(game.params);
  const { games = 20, maxTurns = 1000 } = opts;
  const kinds = new Set<string>();
  const cardKinds = new Set<string>();
  const cellKinds = new Set<string>();
  let decisions = 0;
  let choices = 0;
  let options = 0;
  let moves = 0;
  let chance = 0;
  let direct = 0;
  let shared = 0;
  const opening = (seed: number) => safely(() => JSON.stringify(game.setup({ numPlayers, params, rng: createRng(seed) })), "");
  const setupChance = opening(1) !== opening(2);

  for (let g = 0; g < games; g++) {
    const seed = 1 + g;
    opts.onGame?.(seed);
    const pick = createRng(10_000 + seed);
    let state = game.setup({ numPlayers, params, rng: createRng(seed) });
    for (let turn = 0; turn < maxTurns && !game.isTerminal(state); turn++) {
      const [player] = game.activePlayers(state);
      const legal = game.legalMoves(state, player);
      if (legal.length === 0) break;
      decisions++;
      choices += legal.length;
      if (legal.length > 1) options++;
      const move = legal[pick.int(legal.length)];
      kinds.add(kindOf(move));
      const before = snapshot(game, state);
      // The same move under two different streams of chance: if the results differ, chance decided it.
      const next = game.applyMove(state, player, move, createRng(seed * 100_003 + turn));
      const other = game.applyMove(state, player, move, createRng(seed * 100_003 + turn + 7919));
      if (JSON.stringify(next) !== JSON.stringify(other)) chance++;
      state = next;
      const after = snapshot(game, state);
      const touch = touched(before, after, player);
      if (touch.direct) direct++;
      if (touch.shared) shared++;
      moves++;
      if (turn % 10 === 0) {
        for (const panel of safely(() => game.panels?.(state, player) ?? [], [])) for (const card of panel.cards ?? []) if (!card.faceDown) cardKinds.add(cardKind(card.title));
        for (const cell of safely(() => game.geometry?.(state, player)?.cells ?? [], [])) if (cell.kind && cell.kind !== "label") cellKinds.add(cell.kind);
      }
    }
  }

  const measures: ProfileMeasures = {
    games,
    numPlayers,
    moveKinds: kinds.size,
    choices: decisions ? choices / decisions : 0,
    choiceRate: decisions ? options / decisions : 0,
    components: (game.meta.resources?.length ?? 0) + cardKinds.size + cellKinds.size,
    setupChance,
    chanceRate: moves ? chance / moves : 0,
    directRate: moves ? direct / moves : 0,
    sharedRate: moves ? shared / moves : 0,
  };
  if (opts.planner && (opts.plannerGames ?? 0) > 0) {
    return withPlanner(measures, plannerWinRate(game, opts.planner, { numPlayers, params, games: opts.plannerGames!, onGame: opts.onGame }));
  }
  return measures;
}

/** Adds a measured planner win rate (and the skill edge it gives) to the measurements. */
export const withPlanner = (m: ProfileMeasures, rate: number): ProfileMeasures => ({
  ...m,
  plannerWinRate: rate,
  skillEdge: (rate - 1 / m.numPlayers) / (1 - 1 / m.numPlayers),
});

/** Share of games `planner` wins against random players, taking every seat in turn. */
export function plannerWinRate(
  game: GameModule,
  planner: Bot,
  opts: { numPlayers: number; params?: Params; games: number; onGame?(seed: number): void },
): number {
  const { numPlayers, games } = opts;
  let wins = 0;
  let played = 0;
  for (let seat = 0; seat < numPlayers; seat++) {
    const bots = Array.from({ length: numPlayers }, (_, i) => (i === seat ? planner : randomBot));
    const stats = simulate(game, { numPlayers, params: opts.params, games: Math.ceil(games / numPlayers), seed: 1000 + 100 * seat, bots, onGame: opts.onGame });
    wins += stats.winRateBySeat[seat] * stats.games;
    played += stats.games;
  }
  return played ? wins / played : 0;
}

const clamp = (x: number) => Math.round(Math.min(5, Math.max(1, x)) * 10) / 10;

/**
 * 1–5 scores from the measurements, set so the fixture games land where players would put them:
 * a dice race near 1 for strategy and 4–5 for luck, Reversi at 1 for luck and 5 for interaction.
 */
export function scoreProfile(m: ProfileMeasures): GameProfile {
  // Chance against choice: how much of what happens is rolled rather than decided.
  const rolled = m.chanceRate + m.choiceRate > 0 ? m.chanceRate / (m.chanceRate + m.choiceRate) : 0;
  return {
    complexity: clamp(0.6 + 0.45 * Math.log2(Math.max(1, m.moveKinds)) + 0.2 * Math.log2(Math.max(1, m.choices)) + 0.3 * Math.log2(1 + m.components)),
    strategy: m.skillEdge === undefined ? undefined : clamp(1 + 4 * m.skillEdge),
    luck: clamp(1 + (m.setupChance ? 0.8 : 0) + 4 * rolled),
    interaction: clamp(1 + 4 * (m.directRate + 0.5 * m.sharedRate)),
    measures: m,
  };
}

export const profileGame = (game: GameModule, opts: ProfileOptions = {}) => scoreProfile(measureProfile(game, opts));
