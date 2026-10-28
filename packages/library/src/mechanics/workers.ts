import type { PlayerId } from "@boarddream/engine";

/**
 * Worker placement: players take turns sending workers to action spaces. A space holds a limited
 * number of workers, so taking it first blocks rivals until everyone's workers come home.
 */

export interface ActionSpace {
  id: string;
  /** Workers the space holds; leave it out for a space with room for everyone. */
  capacity?: number;
}

/** Space id to the seats of the workers on it, in the order they arrived. */
export type Placements = Record<string, PlayerId[]>;

export const occupants = (placed: Placements, space: string): PlayerId[] => placed[space] ?? [];

export const hasRoom = (space: ActionSpace, placed: Placements) =>
  space.capacity === undefined || occupants(placed, space.id).length < space.capacity;

/**
 * Spaces `player` may use now: those with room, and with `onePerPlayer` only those the player is
 * not on yet.
 */
export function openSpaces<S extends ActionSpace>(spaces: readonly S[], placed: Placements, player: PlayerId, onePerPlayer = false): S[] {
  return spaces.filter((space) => hasRoom(space, placed) && !(onePerPlayer && occupants(placed, space.id).includes(player)));
}

export function place(placed: Placements, space: string, player: PlayerId): Placements {
  return { ...placed, [space]: [...occupants(placed, space), player] };
}

/** Workers `player` has out on the board. */
export const placedBy = (placed: Placements, player: PlayerId) =>
  Object.values(placed).reduce((sum, seats) => sum + seats.filter((seat) => seat === player).length, 0);

/** Next seat after `current` in `order` that still has a worker to place, or undefined when the round is over. */
export function nextToPlace(order: readonly PlayerId[], current: PlayerId, workersLeft: (seat: PlayerId) => number): PlayerId | undefined {
  const at = order.indexOf(current);
  for (let step = 1; step <= order.length; step++) {
    const seat = order[(at + step) % order.length];
    if (workersLeft(seat) > 0) return seat;
  }
  return undefined;
}
