/** End-of-game scoring: highest score wins, ties share, a full tie is a draw. */

/** Seats with the highest score among `eligible` ones. */
export function leaders(scores: readonly number[], eligible: (seat: number) => boolean = () => true): number[] {
  const seats = scores.map((_, seat) => seat).filter(eligible);
  if (seats.length === 0) return [];
  const best = Math.max(...seats.map((seat) => scores[seat]));
  return seats.filter((seat) => scores[seat] === best);
}

/**
 * Outcome winners by score: the leaders, or [] (a draw) when every seat ties. An optional
 * `tiebreak` (more is better, e.g. money left) settles ties between the leaders first.
 */
export function scoreWinners(scores: readonly number[], tiebreak?: readonly number[]): number[] {
  let top = leaders(scores);
  if (tiebreak && top.length > 1) {
    const tied = top;
    top = leaders(tiebreak, (seat) => tied.includes(seat));
  }
  return top.length === scores.length ? [] : top;
}

/** Seats at or above `target`, for first-to-N races. */
export const reachedTarget = (scores: readonly number[], target: number) =>
  scores.flatMap((score, seat) => (score >= target ? [seat] : []));
