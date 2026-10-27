/** End-of-game scoring: highest score wins, ties share, a full tie is a draw. */

/** Seats with the highest score among `eligible` ones. */
export function leaders(scores: readonly number[], eligible: (seat: number) => boolean = () => true): number[] {
  const seats = scores.map((_, seat) => seat).filter(eligible);
  if (seats.length === 0) return [];
  const best = Math.max(...seats.map((seat) => scores[seat]));
  return seats.filter((seat) => scores[seat] === best);
}

/** Outcome winners by score: the leaders, or [] (a draw) when every seat ties. */
export function scoreWinners(scores: readonly number[]): number[] {
  const top = leaders(scores);
  return top.length === scores.length ? [] : top;
}

/** Seats at or above `target`, for first-to-N races. */
export const reachedTarget = (scores: readonly number[], target: number) =>
  scores.flatMap((score, seat) => (score >= target ? [seat] : []));
