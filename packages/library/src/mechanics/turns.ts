/** Turn order around the table, skipping seats that are out. */

/** Next seat after `current` in `direction` that `inPlay` accepts, or `current` if no other seat does. */
export function nextSeat(
  current: number,
  numPlayers: number,
  inPlay: (seat: number) => boolean = () => true,
  direction: 1 | -1 = 1,
): number {
  for (let step = 1; step <= numPlayers; step++) {
    const seat = (((current + direction * step) % numPlayers) + numPlayers) % numPlayers;
    if (inPlay(seat)) return seat;
  }
  return current;
}

/** Every seat in turn order, starting from `first`. */
export function seatOrder(first: number, numPlayers: number, direction: 1 | -1 = 1): number[] {
  return Array.from({ length: numPlayers }, (_, step) => (((first + direction * step) % numPlayers) + numPlayers) % numPlayers);
}
