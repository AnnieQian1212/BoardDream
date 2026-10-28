import type { PlayerId, Rng } from "@boarddream/engine";

/**
 * Cooperative shared threat: the game itself is the opponent. Every round an event deck strikes
 * places on the board and raises their threat; a place pushed past its limit overflows into its
 * neighbors (a chain reaction that can cascade) and advances a shared doom track. The rate of
 * events climbs as the game goes on. Players spend their actions lowering threat and working
 * toward a goal; everyone wins together, or everyone loses when the doom track or time runs out.
 */

/** Threat on each place, e.g. { reactor: 2, galley: 0 }. Missing places count as zero. */
export type Levels = Record<string, number>;

export interface StrikeResult {
  levels: Levels;
  /** Places that overflowed, in the order they did; each overflows at most once per strike. */
  overflows: string[];
}

/**
 * Adds `amount` threat to `place`. Threat above `max` does not stack: the place overflows instead
 * and adds 1 threat to each neighbor, which can overflow in turn. A place overflows at most once
 * per strike, so chains always end.
 */
export function strike(levels: Levels, place: string, amount: number, max: number, neighbors: (place: string) => readonly string[]): StrikeResult {
  const next = { ...levels };
  const overflows: string[] = [];
  const queue: [string, number][] = [[place, amount]];
  while (queue.length > 0) {
    const [at, add] = queue.shift()!;
    const total = (next[at] ?? 0) + add;
    if (total <= max) {
      next[at] = total;
    } else {
      next[at] = max;
      if (!overflows.includes(at)) {
        overflows.push(at);
        for (const near of neighbors(at)) if (!overflows.includes(near)) queue.push([near, 1]);
      }
    }
  }
  return { levels: next, overflows };
}

/** Lowers threat on `place` by up to `amount`, never below zero. */
export function relieve(levels: Levels, place: string, amount: number): Levels {
  return { ...levels, [place]: Math.max(0, (levels[place] ?? 0) - amount) };
}

/** Total threat on the board. */
export const totalThreat = (levels: Levels) => Object.values(levels).reduce((sum, n) => sum + n, 0);

/** Places at or above `level`, most threatened first. */
export const hotspots = (levels: Levels, level: number) =>
  Object.entries(levels)
    .filter(([, n]) => n >= level)
    .sort((a, b) => b[1] - a[1])
    .map(([place]) => place);

/**
 * Events per round from an escalation schedule that climbs with each `escalations` (surges drawn,
 * rounds survived): rate(0, [2, 2, 3, 3, 4]) is 2, and past the end it stays at the last step.
 */
export const rate = (escalations: number, schedule: readonly number[]) => schedule[Math.min(Math.max(0, escalations), schedule.length - 1)];

export interface EventDeck<T> {
  drawPile: T[];
  discard: T[];
}

/**
 * A surge: the discards are shuffled and put back on top of the draw pile, so places that were
 * just struck come up again soon.
 */
export function intensify<T>(rng: Rng, deck: EventDeck<T>): EventDeck<T> {
  return { drawPile: [...rng.shuffle(deck.discard), ...deck.drawPile], discard: [] };
}

/** Draws `n` events into the discard pile; an empty draw pile reshuffles the discards first. */
export function drawEvents<T>(rng: Rng, deck: EventDeck<T>, n: number): { events: T[]; deck: EventDeck<T> } {
  let drawPile = deck.drawPile.slice();
  let discard = deck.discard.slice();
  const events: T[] = [];
  while (events.length < n) {
    if (drawPile.length === 0) {
      if (discard.length === 0) break;
      drawPile = rng.shuffle(discard);
      discard = [];
    }
    const event = drawPile.shift()!;
    events.push(event);
    discard.push(event);
  }
  return { events, deck: { drawPile, discard } };
}

/** Everyone wins or nobody does: the outcome of a cooperative game. */
export const teamOutcome = (won: boolean, numPlayers: number): { winners: PlayerId[] } => ({
  winners: won ? Array.from({ length: numPlayers }, (_, seat) => seat) : [],
});
