/** Escalating "at least N of face F" claims, as in dice bluffing games. */

export interface Bid {
  quantity: number;
  face: number;
}

/** True if `bid` outranks `current`: more dice, or the same count of a higher face. */
export const isHigherBid = (bid: Bid, current: Bid | null) =>
  current === null || bid.quantity > current.quantity || (bid.quantity === current.quantity && bid.face > current.face);

/**
 * Every legal raise over `current`, lowest first. Quantities stop at `maxQuantity` and may jump at
 * most `maxJump` above the current quantity, which keeps the move list short.
 */
export function raisesAbove(
  current: Bid | null,
  opts: { maxQuantity: number; faces: readonly number[]; maxJump?: number },
): Bid[] {
  const { maxQuantity, faces, maxJump = 2 } = opts;
  const base = current?.quantity ?? 0;
  const raises: Bid[] = [];
  for (let quantity = Math.max(1, base); quantity <= Math.min(maxQuantity, base + maxJump); quantity++) {
    for (const face of faces) {
      const bid = { quantity, face };
      if (isHigherBid(bid, current)) raises.push(bid);
    }
  }
  return raises;
}
