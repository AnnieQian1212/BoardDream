import type { Counter } from "./types";

/**
 * How a table reads a panel's counters. Generated games name their counters freely, so one list of
 * words decides which counter is a seat's score (shown as the score chip, and what the bots try to
 * raise) and which counters are stacks of cards (drawn as face-down decks). The designer's prompt
 * asks for "Score" and "Deck"; the other words cover the names games pick anyway.
 */

const SCORE = /score|points|\bvp\b|victory|prestige|renown|glory|fame|honou?r/i;
const DECK = /deck|draw|pile|stack/i;

/** A counter of victory points. Resources are never the score, whatever they are called. */
export const isScore = (c: Counter) => !c.resource && SCORE.test(c.label);

/** A seat's score counter, if it shows one. */
export const scoreOf = (counters: readonly Counter[] | undefined) => counters?.find(isScore);

/** A counter that counts a stack of cards: drawn as a face-down deck, not a chip. */
export const isDeck = (c: Counter) => !c.resource && DECK.test(c.label);
