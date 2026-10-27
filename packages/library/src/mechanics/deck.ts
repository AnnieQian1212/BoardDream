import type { Rng } from "@boarddream/engine";

/** Card piles as plain arrays, top card first: build, shuffle, deal, draw with reshuffle. */

/** `copies` of every rank from 1 to `ranks`, e.g. numberedDeck(13, 4) is a standard deck's ranks. */
export function numberedDeck(ranks: number, copies: number): number[] {
  const cards: number[] = [];
  for (let rank = 1; rank <= ranks; rank++) for (let i = 0; i < copies; i++) cards.push(rank);
  return cards;
}

export function standardDeck(): { rank: number; suit: number }[] {
  return numberedDeck(13, 1).flatMap((rank) => [0, 1, 2, 3].map((suit) => ({ rank, suit })));
}

/** Deals round-robin into `numHands` hands, `perHand` each (all cards when omitted). */
export function deal<T>(cards: readonly T[], numHands: number, perHand?: number): { hands: T[][]; rest: T[] } {
  const count = perHand === undefined ? cards.length : Math.min(cards.length, perHand * numHands);
  const hands = Array.from({ length: numHands }, () => [] as T[]);
  for (let i = 0; i < count; i++) hands[i % numHands].push(cards[i]);
  return { hands, rest: cards.slice(count) };
}

/** Draws up to `n` cards from the top; an empty draw pile is refilled by shuffling the discards. */
export function draw<T>(
  rng: Rng,
  piles: { drawPile: readonly T[]; discard: readonly T[] },
  n: number,
): { drawn: T[]; drawPile: T[]; discard: T[] } {
  let drawPile = piles.drawPile.slice();
  let discard = piles.discard.slice();
  const drawn: T[] = [];
  while (drawn.length < n) {
    if (drawPile.length === 0) {
      if (discard.length === 0) break;
      drawPile = rng.shuffle(discard);
      discard = [];
    }
    drawn.push(drawPile.shift()!);
  }
  return { drawn, drawPile, discard };
}

/** Removes `count` cards equal to `card` from a hand. */
export function removeCards<T>(hand: readonly T[], card: T, count: number): T[] {
  const out = hand.slice();
  for (let i = 0; i < count; i++) {
    const at = out.indexOf(card);
    if (at < 0) break;
    out.splice(at, 1);
  }
  return out;
}

/** How many of each value a hand holds. */
export function countByValue(hand: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const card of hand) counts.set(card, (counts.get(card) ?? 0) + 1);
  return counts;
}
