/**
 * The mochi steamer, played while a game is made. A picnic blanket of sixteen spots, a steamer that
 * sets fresh dewdrops on it, and two friends alike pressed together become the next friend up the
 * line, from a dewdrop to the moon. Two moons rise to the sky as a star. Pure rules: the strip that
 * shows them is components/MochiStrip.tsx.
 */

export const COLS = 8;
export const ROWS = 2;
export const SPOTS = COLS * ROWS;
/** Seconds between the batches the steamer makes by itself. */
export const AUTO_STEAM = 8;
/** How often a batch comes out a step ahead, as a mochi rather than a dewdrop. */
export const LUCKY = 0.15;

/** The friends, in the order two of each make the next. */
export const FRIENDS = [
  { name: "Dewdrop", many: "dewdrops", note: "Fresh from the steamer." },
  { name: "Mochi", many: "mochi", note: "Soft and round." },
  { name: "Sakura mochi", many: "sakura mochi", note: "Wears a leaf for spring." },
  { name: "Matcha mochi", many: "matcha mochi", note: "A sprout on top." },
  { name: "Chick", many: "chicks", note: "Peeps when you hold it." },
  { name: "Bunny", many: "bunnies", note: "All ears." },
  { name: "Kitty", many: "kitties", note: "Naps in any sunny spot." },
  { name: "Bear", many: "bears", note: "A hug in a bun." },
  { name: "Panda", many: "pandas", note: "Rare, and very round." },
  { name: "Moon", many: "moons", note: "Two moons rise to the sky as a star." },
] as const;
export const TOP = FRIENDS.length - 1;

export interface Patch {
  /** Each spot of the blanket: the friend sitting there (its place in FRIENDS), or nothing. */
  spots: (number | null)[];
  /** The furthest friend made so far: every one up to it has been met. */
  best: number;
  /** Moons risen to the sky. */
  stars: number;
  seed: number;
}

export type Outcome =
  | { kind: "none" }
  | { kind: "move"; to: number }
  | { kind: "swap"; to: number }
  | { kind: "merge"; to: number; friend: number; fresh: boolean }
  | { kind: "rise"; to: number };

/** A seeded draw in [0, 1) and the seed after it. */
function roll(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), next | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** A new blanket: two dewdrops to press together, and a mochi waiting for its pair. */
export function start(): Patch {
  const spots: (number | null)[] = new Array(SPOTS).fill(null);
  spots[1] = 0;
  spots[3] = 0;
  spots[10] = 1;
  return { spots, best: 1, stars: 0, seed: 20261102 };
}

export const empties = (p: Patch): number[] => p.spots.flatMap((s, i) => (s === null ? [i] : []));

/** The steamer's batch, set on an empty spot at random; no spot is taken when the blanket is full. */
export function steam(p: Patch): { patch: Patch; at?: number } {
  const open = empties(p);
  if (!open.length) return { patch: p };
  const [where, s1] = roll(p.seed);
  const [luck, seed] = roll(s1);
  const at = open[Math.floor(where * open.length)];
  const friend = luck < LUCKY ? 1 : 0;
  const spots = p.spots.slice();
  spots[at] = friend;
  return { patch: { ...p, spots, best: Math.max(p.best, friend), seed }, at };
}

/**
 * The friend on `from` pressed onto `to`: two alike make the next friend on `to` (two moons rise
 * and leave both spots empty), onto an empty spot it moves, and onto another friend they swap.
 */
export function press(p: Patch, from: number, to: number): { patch: Patch; outcome: Outcome } {
  const a = p.spots[from];
  const b = p.spots[to];
  if (from === to || a === null || a === undefined || b === undefined) return { patch: p, outcome: { kind: "none" } };
  const spots = p.spots.slice();
  spots[from] = null;
  if (b === null) {
    spots[to] = a;
    return { patch: { ...p, spots }, outcome: { kind: "move", to } };
  }
  if (b !== a) {
    spots[from] = b;
    spots[to] = a;
    return { patch: { ...p, spots }, outcome: { kind: "swap", to } };
  }
  if (a === TOP) {
    spots[to] = null;
    return { patch: { ...p, spots, stars: p.stars + 1 }, outcome: { kind: "rise", to } };
  }
  spots[to] = a + 1;
  return {
    patch: { ...p, spots, best: Math.max(p.best, a + 1) },
    outcome: { kind: "merge", to, friend: a + 1, fresh: a + 1 > p.best },
  };
}

/** Two alike to point out to a player who has stopped, the earliest friends first. */
export function pair(p: Patch): [number, number] | undefined {
  for (let f = 0; f <= TOP; f++) {
    const at = p.spots.flatMap((s, i) => (s === f ? [i] : []));
    if (at.length >= 2) return [at[0], at[1]];
  }
  return undefined;
}

const isFriend = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= TOP;

/** A saved blanket, checked; anything unreadable starts afresh. */
export function revive(x: unknown): Patch {
  const s = x as Partial<Patch> | null | undefined;
  if (!s || !Array.isArray(s.spots) || s.spots.length !== SPOTS) return start();
  const spots = s.spots.map((f) => (isFriend(f) ? f : null));
  const best = Math.max(isFriend(s.best) ? s.best : 0, ...spots.map((f) => f ?? 0));
  const stars = Number.isInteger(s.stars) && (s.stars as number) > 0 ? (s.stars as number) : 0;
  const seed = Number.isInteger(s.seed) ? (s.seed as number) : 20261102;
  return { spots, best, stars, seed };
}
