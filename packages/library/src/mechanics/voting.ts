/** Voting and elimination: tally ballots, find the most-voted or a strict majority. */

/** Votes per candidate seat; null ballots are abstentions. */
export function tally(votes: readonly (number | null)[], numCandidates: number): number[] {
  const counts = new Array<number>(numCandidates).fill(0);
  for (const vote of votes) if (vote !== null && vote >= 0 && vote < numCandidates) counts[vote]++;
  return counts;
}

/** Seats tied for the most votes, or [] when nobody voted. */
export function topVoted(votes: readonly (number | null)[], numCandidates: number): number[] {
  const counts = tally(votes, numCandidates);
  const best = Math.max(0, ...counts);
  return best === 0 ? [] : counts.flatMap((count, seat) => (count === best ? [seat] : []));
}

/** The seat with more than half of all ballots cast (abstentions excluded), or null. */
export function majority(votes: readonly (number | null)[], numCandidates: number): number | null {
  const cast = votes.filter((v) => v !== null).length;
  const counts = tally(votes, numCandidates);
  const seat = counts.findIndex((count) => count * 2 > cast);
  return seat < 0 ? null : seat;
}
