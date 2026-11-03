/**
 * The first of the sizes from, from·0.94, from·0.94², ... that fits, or the first under 4 when none
 * larger does: what stepping down one size at a time finds, found by halving the range of steps
 * instead (fitting is all-or-nothing in size: a name that fits at one size fits at any smaller).
 * Stepping measured a name up to forty times, and laying out a board's names after a move took
 * half a second of the page.
 */
export function firstFitting(from: number, fits: (size: number) => boolean): number {
  const sizeAt = (step: number) => from * 0.94 ** step;
  if (from <= 4 || fits(from)) return from;
  // Step `last` is the first under 4.
  const last = Math.max(1, Math.ceil(Math.log(4 / from) / Math.log(0.94)));
  let [lo, hi] = [0, last];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (fits(sizeAt(mid))) hi = mid;
    else lo = mid;
  }
  return sizeAt(hi);
}
