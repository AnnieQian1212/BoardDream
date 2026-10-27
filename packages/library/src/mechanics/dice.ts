import type { Rng } from "@boarddream/engine";

/** Dice rolls, face counting and the binomial odds behind dice bluffing. */

/** One roll, 1..sides. */
export const roll = (rng: Rng, sides = 6) => rng.int(sides) + 1;

export const rollMany = (rng: Rng, count: number, sides = 6) => Array.from({ length: count }, () => roll(rng, sides));

/** Dice showing `face`. Dice showing `wild` count toward every other face as well. */
export function countFace(dice: readonly number[], face: number, wild?: number): number {
  return dice.filter((d) => d === face || (wild !== undefined && face !== wild && d === wild)).length;
}

/** Chance of at least k successes in n independent trials that each succeed with probability p. */
export function atLeastProbability(n: number, p: number, k: number): number {
  if (k <= 0) return 1;
  if (k > n || p <= 0) return 0;
  if (p >= 1) return 1;
  let term = Math.pow(1 - p, n); // P(exactly 0)
  let below = 0;
  for (let i = 0; i < k; i++) {
    below += term;
    term *= ((n - i) / (i + 1)) * (p / (1 - p));
  }
  return Math.max(0, 1 - below);
}
