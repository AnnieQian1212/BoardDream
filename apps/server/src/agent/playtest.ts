import { createRng, heuristicBot, largestGap, plannerResult, randomBot, randomPlayout, resolveParams, sampleSeats, simulate, type GameModule } from "@boarddream/engine";
import type { PlayStats } from "./protocol";

/**
 * After rules pass fuzzing (they never break), a quick playtest looks for games that work but
 * are not worth playing: over in a few moves, nearly always drawn, a seat that never wins, only
 * one kind of move, or decisions that barely change who wins.
 */

export type { PlayStats } from "./protocol";

export interface PlaytestOptions {
  games?: number;
  /** Games the planner plays, spread over every seat. */
  plannerGames?: number;
  /** Called with each simulated game's seed before it starts (heartbeats for the checker's watchdog). */
  onGame?(seed: number): void;
  /**
   * Time the planner may take, in milliseconds. It looks a few moves ahead in short playouts, which
   * in a game with dozens of legal moves takes minutes; a slow game then measures fewer games.
   */
  plannerMs?: number;
}

/** Fewer planner games than this say too little to call a game shallow. */
const MIN_PLANNER_GAMES = 12;

const kindOf = (move: unknown): string =>
  move !== null && typeof move === "object" && "type" in move ? String((move as { type: unknown }).type) : typeof move;

/** Bluffing is what the planner cannot do, so in those games its win rate says nothing about skill. */
const skillMeasurable = (game: GameModule) => game.meta.mode === "competitive" && game.meta.family !== "bluff";

/** Playtests seat three players when the game allows it. */
export const playtestPlayers = sampleSeats;

export function playtest(game: GameModule, opts: PlaytestOptions = {}): PlayStats {
  const { games = 100, plannerGames = 30, onGame, plannerMs = 30_000 } = opts;
  const numPlayers = playtestPlayers(game);
  const stats = simulate(game, { numPlayers, games, bots: new Array(numPlayers).fill(randomBot), onGame });
  // Replay a few random games by hand to see how many real choices players get.
  const kinds = new Set<string>();
  let turns = 0;
  let choices = 0;
  for (let seed = 1; seed <= 10; seed++) {
    randomPlayout(game, { numPlayers, seed, maxTurns: 1000 }, ({ moves, move }) => {
      turns++;
      if (moves.length > 1) choices++;
      kinds.add(kindOf(move));
    });
  }
  const measurable = skillMeasurable(game) && plannerGames > 0;
  const planner = measurable
    ? plannerResult(game, heuristicBot({ rollouts: 6, depth: 16 }), { numPlayers, games: plannerGames, deadline: Date.now() + plannerMs, onGame })
    : undefined;
  return {
    numPlayers,
    games: stats.games,
    medianTurns: stats.medianTurns,
    drawRate: stats.drawRate,
    winRateBySeat: stats.winRateBySeat,
    truncatedRate: stats.truncatedRate,
    moveKinds: [...kinds].sort(),
    choiceRate: turns ? choices / turns : 0,
    // The planner takes each seat in turn against random players.
    plannerWinRate: planner?.winRate,
    plannerGames: planner?.games,
  };
}

/**
 * How far the planner's win rate sits between the fair share (0) and always winning (1). In the
 * reference games it is 0.50-0.70; in a pure dice race it is about 0.
 */
export const skillEdge = (stats: PlayStats): number | undefined =>
  stats.plannerWinRate === undefined ? undefined : (stats.plannerWinRate - 1 / stats.numPlayers) / (1 - 1 / stats.numPlayers);

/** Design problems worth a repair round, in words the designer model can act on. */
export function playIssues(stats: PlayStats, mode: GameModule["meta"]["mode"]): string[] {
  const issues: string[] = [];
  if (stats.medianTurns < 3 * stats.numPlayers) {
    issues.push(`games are over too fast: the median game lasts ${stats.medianTurns} moves with ${stats.numPlayers} players`);
  }
  // In cooperative games an empty winner list is a loss, not a draw.
  if (mode === "competitive" && stats.drawRate > 0.6) issues.push(`${Math.round(stats.drawRate * 100)}% of random games end in a draw or a shared result`);
  if (stats.truncatedRate > 0.05) issues.push(`${Math.round(stats.truncatedRate * 100)}% of random games hit the engine's turn cap without ending`);
  if (mode === "competitive" && stats.games >= 50) {
    const never = stats.winRateBySeat.flatMap((rate, seat) => (rate === 0 ? [seat + 1] : []));
    if (never.length > 0) issues.push(`seat ${never.join(" and ")} never won in ${stats.games} random games`);
  }
  if (stats.choiceRate < 0.3) {
    issues.push(`players have a real choice on only ${Math.round(stats.choiceRate * 100)}% of turns; most turns offer a single legal move`);
  }
  // Too few planner games (a slow game out of time) say nothing either way.
  const edge = (stats.plannerGames ?? Infinity) >= MIN_PLANNER_GAMES ? skillEdge(stats) : undefined;
  const fair = 1 / stats.numPlayers;
  if (edge !== undefined && stats.plannerWinRate! < 0.75 * fair) {
    // Planning by the standings loses to random play: the standings point the wrong way.
    issues.push(
      `the mid-game scores mislead: a player who plans by the standings in outcome(state).scores wins only ${Math.round(stats.plannerWinRate! * 100)}% of ${stats.numPlayers}-player games against random opponents, below the fair share of ${Math.round(fair * 100)}%; make those scores count what decides the game, e.g. majorities, sets and end-game bonuses as if they scored now`,
    );
  } else if (edge !== undefined && edge < 0.25) {
    issues.push(
      `decisions barely matter: a player who plans ahead wins ${Math.round(stats.plannerWinRate! * 100)}% of ${stats.numPlayers}-player games against random opponents, close to the fair share of ${Math.round(100 / stats.numPlayers)}%`,
    );
  }
  return issues;
}

/** An empty block larger than this share of the board reads as a board laid out lopsided. */
export const GAP_SHARE = 0.2;

/**
 * Layout problems in the board the table draws at the start of a game, in words the designer model
 * can act on. Drawing code that throws is the fuzzer's to report, not this.
 */
export function boardIssues(game: GameModule): string[] {
  if (!game.geometry) return [];
  let gap;
  try {
    const numPlayers = playtestPlayers(game);
    const state = game.setup({ numPlayers, params: resolveParams(game.params), rng: createRng(1) });
    gap = largestGap(game.geometry(state, 0));
  } catch {
    return [];
  }
  if (gap.area <= GAP_SHARE) return [];
  const pct = (share: number) => `${Math.round(share * 100)}%`;
  return [
    `the board is lopsided: an empty block ${gap.where} covers ${pct(gap.area)} of it (${pct(gap.width)} of its width, ${pct(gap.height)} of its height); ` +
      "in geometry(), lay the board out as one compact block, the main area in the middle and side areas (action spaces, tracks, supplies) " +
      "in rows or columns around it, none longer than the side it lies along, and set width and height to just cover the cells",
  ];
}
