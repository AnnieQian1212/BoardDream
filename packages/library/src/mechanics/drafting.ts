import type { PlayerId } from "@boarddream/engine";

/**
 * Card drafting. Pick and pass: everyone holds a hand, secretly keeps one card, then passes the
 * rest to a neighbor until the hands run out. Picks are simultaneous: keep the draft in state, hide
 * other seats' hands and picks in view (hideDraft), list only the seats still choosing in
 * activePlayers (waiting), and once every seat has picked, reveal the picks and pass (resolve).
 * Open drafting from a shared face-up pool goes in turn order instead, often snake order.
 */

export interface Draft<T> {
  /** Each seat's current hand. */
  hands: T[][];
  /** The hand index each seat chose this step, or null while it is still choosing. */
  picks: (number | null)[];
  /** 1 passes each hand to the next seat, -1 to the previous one. */
  direction: 1 | -1;
}

export function startDraft<T>(hands: readonly (readonly T[])[], direction: 1 | -1 = 1): Draft<T> {
  return { hands: hands.map((hand) => hand.slice()), picks: hands.map(() => null), direction };
}

/** Seats that still have to pick this step. */
export const waiting = <T>(draft: Draft<T>): PlayerId[] =>
  draft.picks.flatMap((pick, seat) => (pick === null && draft.hands[seat].length > 0 ? [seat] : []));

export const allPicked = <T>(draft: Draft<T>) => waiting(draft).length === 0;

/** Records `seat`'s choice of the card at `index` in its hand. */
export function pick<T>(draft: Draft<T>, seat: PlayerId, index: number): Draft<T> {
  if (draft.picks[seat] !== null) throw new Error(`seat ${seat} has already picked`);
  if (!Number.isInteger(index) || index < 0 || index >= draft.hands[seat].length) {
    throw new Error(`seat ${seat} has no card at index ${index}`);
  }
  return { ...draft, picks: draft.picks.map((p, s) => (s === seat ? index : p)) };
}

/** Seat s's hand goes to seat s + direction. */
export function passHands<T>(hands: readonly (readonly T[])[], direction: 1 | -1): T[][] {
  const n = hands.length;
  const passed: T[][] = new Array(n);
  hands.forEach((hand, seat) => (passed[(((seat + direction) % n) + n) % n] = hand.slice()));
  return passed;
}

/**
 * Reveals every pick once all seats have chosen: picked[seat] is the card that seat kept (null if
 * its hand was empty), and the rest of each hand passes on.
 */
export function resolve<T>(draft: Draft<T>): { picked: (T | null)[]; draft: Draft<T> } {
  if (!allPicked(draft)) throw new Error(`seats ${waiting(draft).join(", ")} have not picked`);
  const picked = draft.hands.map((hand, seat) => {
    const at = draft.picks[seat];
    return at === null ? null : hand[at];
  });
  const kept = draft.hands.map((hand, seat) => hand.filter((_, i) => i !== draft.picks[seat]));
  return { picked, draft: { ...draft, hands: passHands(kept, draft.direction), picks: draft.picks.map(() => null) } };
}

/** True once every hand is down to `leftover` cards (0: everything drafted; 1: the last card is discarded). */
export const draftOver = <T>(draft: Draft<T>, leftover = 0) => draft.hands.every((hand) => hand.length <= leftover);

/** Pass left in even rounds and right in odd ones (rounds counted from 0). */
export const roundDirection = (round: number): 1 | -1 => (round % 2 === 0 ? 1 : -1);

/**
 * What `viewer` may see: its own hand and pick; other hands become `hidden` cards (their size
 * still shows) and other picks just "hidden" once made. With no viewer, everything is hidden.
 */
export function hideDraft<T, H>(
  draft: Draft<T>,
  viewer: PlayerId | undefined,
  hidden: H,
): { hands: (T | H)[][]; picks: (number | null | "hidden")[]; direction: 1 | -1 } {
  return {
    hands: draft.hands.map((hand, seat) => (seat === viewer ? hand.slice() : hand.map(() => hidden))),
    picks: draft.picks.map((p, seat) => (seat === viewer || p === null ? p : "hidden")),
    direction: draft.direction,
  };
}

/**
 * Seat order for open drafting from a shared pool: `rounds` passes around the table, reversing
 * each time (0 1 2 2 1 0 0 1 2 ...), so the last seat to pick in one pass picks first in the next.
 */
export function snakeOrder(numPlayers: number, rounds: number, first: PlayerId = 0): PlayerId[] {
  const order: PlayerId[] = [];
  for (let round = 0; round < rounds; round++) {
    for (let step = 0; step < numPlayers; step++) {
      const offset = round % 2 === 0 ? step : numPlayers - 1 - step;
      order.push((first + offset) % numPlayers);
    }
  }
  return order;
}
