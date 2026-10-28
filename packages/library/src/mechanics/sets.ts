/**
 * Set collection: score a player's cards or tokens by kind (suit, color, tag). Sets of one kind
 * score by how many of it a player has, sets of different kinds by how many kinds they span, and
 * a full set needs one of each listed kind. Point tables run by size: [1, 3, 6, 10] scores 1 for a
 * set of one, 3 for two, and so on; sizes past the end of the table score its last entry.
 */

export type Counts = Record<string, number>;

/** How many of each kind, e.g. ["fish", "fish", "fern"] gives { fish: 2, fern: 1 }. */
export function countKinds<T>(items: readonly T[], kindOf: (item: T) => string = String): Counts {
  const counts: Counts = {};
  for (const item of items) {
    const kind = kindOf(item);
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return counts;
}

/** Points for a set of `size` from a table that starts at size 1. */
export function tablePoints(size: number, table: readonly number[]): number {
  if (size <= 0 || table.length === 0) return 0;
  return table[Math.min(size, table.length) - 1];
}

/**
 * Sizes of the sets of different kinds made by repeatedly taking one of every kind still left,
 * largest first: { a: 3, b: 1, c: 1 } gives [3, 1, 1]. `kinds` limits which kinds count, and
 * `maxSize` caps a set (the kinds with the most left go in first).
 */
export function distinctSets(counts: Counts, kinds?: readonly string[], maxSize = Infinity): number[] {
  const left = Object.entries(counts)
    .filter(([kind, n]) => n > 0 && (!kinds || kinds.includes(kind)))
    .map(([, n]) => n);
  const sizes: number[] = [];
  while (left.some((n) => n > 0)) {
    left.sort((a, b) => b - a);
    let size = 0;
    for (let i = 0; i < left.length && size < maxSize; i++) {
      if (left[i] > 0) {
        left[i]--;
        size++;
      }
    }
    sizes.push(size);
  }
  return sizes;
}

/** Complete sets that need one of each of `kinds`: the count of the scarcest one. */
export const fullSets = (counts: Counts, kinds: readonly string[]) =>
  kinds.length === 0 ? 0 : Math.min(...kinds.map((kind) => counts[kind] ?? 0));

/** Sets of `size` matching items across all kinds: { a: 5, b: 2 } with size 2 makes 3. */
export const sameKindSets = (counts: Counts, size: number) =>
  Object.values(counts).reduce((sum, n) => sum + Math.floor(n / size), 0);

/** Each kind scored by its count on `table`: { a: 3, b: 1 } with [1, 3, 6] scores 6 + 1. */
export function scoreByKind(counts: Counts, table: readonly number[]): number {
  return Object.values(counts).reduce((sum, n) => sum + tablePoints(n, table), 0);
}

/** Sets of different kinds (see distinctSets), each scored by its size on `table`. */
export function scoreDistinctSets(counts: Counts, table: readonly number[], kinds?: readonly string[], maxSize?: number): number {
  return distinctSets(counts, kinds, maxSize).reduce((sum, size) => sum + tablePoints(size, table), 0);
}
