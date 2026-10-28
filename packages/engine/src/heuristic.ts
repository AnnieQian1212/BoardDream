import type { Bot } from "./match";
import type { Rng } from "./rng";
import type { GameModule, Geometry, Panel, PlayerId } from "./types";

/**
 * A bot for any game, including generated ones: it reads the same score, resource and card
 * counts the table shows, prefers moves that improve its lead, and optionally checks its best few
 * candidates with short random playouts.
 */

const SCORE = /score|points|\bvp\b|victory|prestige|influence|renown|glory|fame|honou?r/i;

function safely<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Worth of one seat's panel: its score, plus a little for resources held and cards played. */
function seatValue(panel: Panel): number {
  const counters = panel.counters ?? [];
  const score = counters.find((c) => SCORE.test(c.label))?.value ?? 0;
  const goods = counters.filter((c) => c.resource).reduce((sum, c) => sum + c.value, 0);
  return score + 0.12 * goods + 0.3 * (panel.cards?.length ?? 0);
}

/** Board presence: owned cells (roads, claimed tiles) and pieces, the player's minus the best rival's. */
function boardLead(game: GameModule, state: unknown, player: PlayerId): number {
  const geometry = safely(() => game.geometry?.(state, player), undefined as Geometry | undefined);
  if (!geometry) return 0;
  const counts = new Map<PlayerId, number>();
  for (const thing of [...geometry.cells, ...geometry.pieces]) {
    if (thing.owner !== undefined && !("kind" in thing && thing.kind === "label")) counts.set(thing.owner, (counts.get(thing.owner) ?? 0) + 1);
  }
  const mine = counts.get(player) ?? 0;
  const rivals = [...counts].filter(([seat]) => seat !== player).map(([, n]) => n);
  return mine - (rivals.length ? Math.max(...rivals) : 0);
}

/** Score lead: from outcome() when it reports scores mid-game, else from a "Score"-like seat counter. */
function scoreLead(game: GameModule, state: unknown, player: PlayerId, seats: Panel[]): number {
  const scores = safely(() => game.outcome(state).scores, undefined);
  if (scores && scores.length > 1 && scores.every(Number.isFinite)) {
    return (scores[player] ?? 0) - Math.max(...scores.filter((_, seat) => seat !== player));
  }
  const counters = seats.map((p) => ({ seat: p.owner!, score: p.counters?.find((c) => SCORE.test(c.label))?.value ?? 0 }));
  const mine = counters.find((c) => c.seat === player)?.score ?? 0;
  const rivals = counters.filter((c) => c.seat !== player).map((c) => c.score);
  return rivals.length ? mine - Math.max(...rivals) : 0;
}

/** How good `state` looks for `player`: the result once the game is over, otherwise their lead. */
export function evaluate(game: GameModule, state: unknown, player: PlayerId): number {
  if (safely(() => game.isTerminal(state), false)) {
    const { winners } = safely(() => game.outcome(state), { winners: [] as PlayerId[] });
    if (winners.includes(player)) return winners.length === 1 ? 1000 : 600;
    return winners.length === 0 ? 0 : -1000;
  }
  const panels = safely(() => game.panels?.(state, player) ?? [], [] as Panel[]);
  const seats = panels.filter((p) => p.zone === "players" && p.owner !== undefined);
  // Resources and played cards are worth a little: they turn into points later.
  const extras = (p: Panel) => 0.12 * (p.counters ?? []).filter((c) => c.resource).reduce((sum, c) => sum + c.value, 0) + 0.3 * (p.cards?.length ?? 0);
  const mine = seats.find((p) => p.owner === player);
  const rivals = seats.filter((p) => p !== mine).map(extras);
  const hand = panels.find((p) => p.zone === "hand" && p.owner === player)?.cards?.length ?? 0;
  return (
    scoreLead(game, state, player, seats) +
    (mine ? extras(mine) : 0) -
    0.6 * (rivals.length ? Math.max(...rivals) : 0) +
    0.15 * hand +
    0.2 * boardLead(game, state, player)
  );
}

/** Random play from `state` for up to `depth` moves, then the evaluation for `player`. */
function playout(game: GameModule, state: unknown, player: PlayerId, depth: number, rng: Rng): number {
  let current = state;
  for (let step = 0; step < depth; step++) {
    if (safely(() => game.isTerminal(current), true)) break;
    const [seat] = safely(() => game.activePlayers(current), [] as PlayerId[]);
    if (seat === undefined) break;
    const moves = safely(() => game.legalMoves(current, seat), [] as unknown[]);
    if (moves.length === 0) break;
    const next = safely(() => game.applyMove(current, seat, rng.pick(moves), rng), undefined);
    if (next === undefined) break;
    current = next;
  }
  return evaluate(game, current, player);
}

export interface HeuristicOptions {
  /** Random playouts per shortlisted move; 0 plays the best-looking move straight away. */
  rollouts?: number;
  /** Moves per playout. */
  depth?: number;
  /** How many top candidates get playouts. */
  shortlist?: number;
}

export function heuristicBot(opts: HeuristicOptions = {}): Bot {
  const { rollouts = 0, depth = 16, shortlist = 3 } = opts;
  return ({ game, state, player, moves, rng }) => {
    if (moves.length === 1) return moves[0];
    const sim = rng.fork();
    const now = evaluate(game, state, player);
    const scored = moves
      .map((move) => {
        // Bots see the player's view. A move whose result depends on what is hidden (calling a bluff)
        // may not replay on it; such a move counts as neutral rather than bad.
        const next = safely(() => game.applyMove(state, player, move, sim), undefined);
        return { move, next, value: (next === undefined ? now : evaluate(game, next, player)) + rng.next() * 0.01 };
      })
      .sort((a, b) => b.value - a.value);
    if (rollouts === 0 || scored[0].value >= 1000) return scored[0].move;

    let best = scored[0];
    let bestValue = -Infinity;
    for (const candidate of scored.slice(0, shortlist)) {
      if (candidate.next === undefined) {
        if (candidate.value > bestValue) [best, bestValue] = [candidate, candidate.value];
        continue;
      }
      let total = 0;
      for (let i = 0; i < rollouts; i++) total += playout(game, candidate.next, player, depth, sim);
      const value = 0.5 * candidate.value + 0.5 * (total / rollouts);
      if (value > bestValue) [best, bestValue] = [candidate, value];
    }
    return best.move;
  };
}
