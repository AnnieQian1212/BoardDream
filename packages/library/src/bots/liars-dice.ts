import type { Bot } from "@boarddream/engine";
import type { LiarsDiceMove, LiarsDiceView } from "../games/liars-dice";
import type { Bid } from "../mechanics/bidding";
import * as dice from "../mechanics/dice";

/** Chance that a bid is true, given only what `view` reveals: own dice plus everyone's dice count. */
export function bidProbability(view: LiarsDiceView, bid: Bid): number {
  const wild = view.wildOnes ? 1 : undefined;
  const known = dice.countFace(view.myDice, bid.face, wild);
  const unknown = view.diceCounts.reduce((a, b) => a + b, 0) - view.myDice.length;
  const chance = wild !== undefined && bid.face !== wild ? 2 / 6 : 1 / 6;
  return dice.atLeastProbability(unknown, chance, bid.quantity - known);
}

type BidMove = Extract<LiarsDiceMove, { type: "bid" }>;

/**
 * Baseline Liar's Dice opponent, local and free. Calls liar when that is the safer option,
 * otherwise makes the most likely raise, and now and then bluffs with a random raise.
 * LLM opponents fall back to it.
 */
export function liarsDiceBot({ callBelow = 0.35, bluffRate = 0.1 } = {}): Bot {
  return ({ state, moves, rng }) => {
    const view = state as LiarsDiceView;
    const options = moves as LiarsDiceMove[];
    const liar = options.find((m) => m.type === "liar");
    const bids = options.filter((m): m is BidMove => m.type === "bid");
    if (bids.length === 0) return liar ?? options[0];

    let best = bids[0];
    let bestChance = -1;
    for (const bid of bids) {
      const chance = bidProbability(view, bid);
      if (chance > bestChance) {
        best = bid;
        bestChance = chance;
      }
    }
    // Calling loses if the standing bid is true; raising risks being called on our own bid.
    const standing = view.bid ? bidProbability(view, view.bid) : 1;
    if (liar && standing < Math.max(callBelow, 1 - bestChance)) return liar;
    return rng.next() < bluffRate ? rng.pick(bids) : best;
  };
}
