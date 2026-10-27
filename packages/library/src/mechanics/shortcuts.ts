import type { Rng } from "@boarddream/engine";

/** Snakes and ladders: landing on a jump's start square moves you to its end square. */

/** [from, to] pairs; ladders have to > from, snakes to < from. */
export type Jumps = [number, number][];

export function applyJumps(square: number, jumps: readonly (readonly [number, number])[]): number {
  return jumps.find(([from]) => from === square)?.[1] ?? square;
}

/**
 * Random ladders and snakes on a track of `size` squares. No jump touches the first or last square,
 * and no square is used twice, so jumps never chain.
 */
export function generateJumps(rng: Rng, size: number, ladders: number, snakes: number): Jumps {
  const used = new Set<number>([0, size - 1]);
  const pick = (lo: number, hi: number) => {
    if (hi <= lo) return -1;
    for (let tries = 0; tries < 50; tries++) {
      const square = lo + rng.int(hi - lo);
      if (!used.has(square)) {
        used.add(square);
        return square;
      }
    }
    return -1;
  };
  const jumps: Jumps = [];
  for (let i = 0; i < ladders; i++) {
    const from = pick(1, size - 2);
    const to = from < 0 ? -1 : pick(from + 1, size - 1);
    if (to > from) jumps.push([from, to]);
  }
  for (let i = 0; i < snakes; i++) {
    const from = pick(2, size - 1);
    const to = from < 0 ? -1 : pick(1, from);
    if (to >= 0 && to < from) jumps.push([from, to]);
  }
  return jumps;
}

/** Square after moving `steps` forward on a track ending at `last`; overshooting bounces back. */
export function bounceMove(square: number, steps: number, last: number): number {
  const target = square + steps;
  return target <= last ? target : last - (target - last);
}
