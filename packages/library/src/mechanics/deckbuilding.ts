import type { Rng } from "@boarddream/engine";
import { draw } from "./deck";

/**
 * Deck building: every player owns a deck that grows during the game. Each turn they play cards
 * from their hand, then clean up: the hand and the cards in play go to their discard pile and a
 * fresh hand is drawn, reshuffling the discards when the draw pile runs out. Bought cards go to the
 * discard pile, so they show up after the next reshuffle; trashing removes weak cards for good.
 * Cards are plain values compared with ===, best as instance ids from effects.buildDeck.
 */

export interface PlayerDeck<T> {
  drawPile: T[];
  hand: T[];
  /** Cards played this turn. */
  inPlay: T[];
  discard: T[];
}

export type Zone = "drawPile" | "hand" | "inPlay" | "discard";

/** Shuffles a starting deck and draws the first hand. */
export function newDeck<T>(rng: Rng, cards: readonly T[], handSize: number): PlayerDeck<T> {
  return drawCards(rng, { drawPile: rng.shuffle(cards), hand: [], inPlay: [], discard: [] }, handSize);
}

/** Draws up to `n` cards into the hand, reshuffling the discard pile into the draw pile when it runs out. */
export function drawCards<T>(rng: Rng, deck: PlayerDeck<T>, n: number): PlayerDeck<T> {
  const { drawn, drawPile, discard } = draw(rng, deck, n);
  return { ...deck, hand: [...deck.hand, ...drawn], drawPile, discard };
}

/** Moves one copy of `card` from zone `from` to zone `to` (onto the top of a draw pile). */
export function moveCard<T>(deck: PlayerDeck<T>, card: T, from: Zone, to: Zone): PlayerDeck<T> {
  const at = deck[from].indexOf(card);
  if (at < 0) throw new Error(`${String(card)} is not in ${from}`);
  const next = { ...deck, [from]: deck[from].filter((_, i) => i !== at) };
  return { ...next, [to]: to === "drawPile" ? [card, ...next[to]] : [...next[to], card] };
}

/** Plays a card from the hand. */
export const playCard = <T>(deck: PlayerDeck<T>, card: T) => moveCard(deck, card, "hand", "inPlay");

/** Adds a new card, by default to the discard pile; "drawPile" puts it on top of the deck. */
export function gainCard<T>(deck: PlayerDeck<T>, card: T, to: Zone = "discard"): PlayerDeck<T> {
  return { ...deck, [to]: to === "drawPile" ? [card, ...deck[to]] : [...deck[to], card] };
}

/** Removes a card from the game. */
export function trashCard<T>(deck: PlayerDeck<T>, card: T, from: Zone = "hand"): PlayerDeck<T> {
  const at = deck[from].indexOf(card);
  if (at < 0) throw new Error(`${String(card)} is not in ${from}`);
  return { ...deck, [from]: deck[from].filter((_, i) => i !== at) };
}

/** End of turn: the hand and the cards in play go to the discard pile, then a new hand is drawn. */
export function cleanup<T>(rng: Rng, deck: PlayerDeck<T>, handSize: number): PlayerDeck<T> {
  const discarded = { ...deck, hand: [], inPlay: [], discard: [...deck.discard, ...deck.inPlay, ...deck.hand] };
  return drawCards(rng, discarded, handSize);
}

/** Every card the player owns, for end-game scoring. */
export const allCards = <T>(deck: PlayerDeck<T>): T[] => [...deck.drawPile, ...deck.hand, ...deck.inPlay, ...deck.discard];

/**
 * What a viewer sees: the draw pile is face down for everyone (its size shows), and the hand too
 * unless `ownHand`. Cards in play and the discard pile are public.
 */
export function hideDeck<T, H>(deck: PlayerDeck<T>, ownHand: boolean, hidden: H): PlayerDeck<T | H> {
  return {
    drawPile: deck.drawPile.map(() => hidden),
    hand: ownHand ? deck.hand.slice() : deck.hand.map(() => hidden),
    inPlay: deck.inPlay.slice(),
    discard: deck.discard.slice(),
  };
}
