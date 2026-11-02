import type { Bot } from "@boarddream/engine";
import { charterOf, highsail, highsailScore, launchCost, projectedIslands, workersLeft, type HighsailMove, type HighsailState } from "../games/highsail";
import type { CardDef, Effect } from "../mechanics/effects";
import { amountOf, shortfall, total } from "../mechanics/resources";

/** Rough worth of income effects in one round, in points. */
const incomeValue = (effects: Effect[] | undefined) =>
  (effects ?? []).reduce((sum, e) => sum + ("gain" in e ? total(e.gain) * 0.45 : "convert" in e ? 0.5 : "gainPerTag" in e ? 0.8 : 0), 0);

/** Rough worth of one firing of a guild's standing order, in points. */
const triggerValue = (effects: Effect[]) => effects.reduce((sum, e) => sum + ("gain" in e ? total(e.gain) * 0.45 : "points" in e ? e.points : 0), 0);
/** About how many matching charters a seat launches in a round, which sets off a guild's orders or uses its discount. */
const LAUNCHES_PER_ROUND = 0.4;

/**
 * What launching a charter should bring: points, its outpost, income over the rounds left, end-game
 * bonus, and for a guild its orders and discounts over the launches still to come.
 */
function charterValue(card: CardDef, roundsLeft: number, scoringsLeft: number): number {
  const endgame = (card.endgame ?? []).reduce((sum, e) => sum + ("pointsPerTag" in e ? 2 * e.pointsPerTag.points : 0), 0);
  const orders = (card.whenever ?? []).reduce((sum, t) => sum + triggerValue(t.effects), 0) * LAUNCHES_PER_ROUND * roundsLeft;
  const discount = card.discount ? total(card.discount.amounts) * 0.45 * LAUNCHES_PER_ROUND * roundsLeft : 0;
  return card.points + (scoringsLeft > 0 ? 1.5 : 0) + incomeValue(card.income) * roundsLeft + endgame + orders + discount;
}

/** How good a position looks for `seat`: its score plus what its crew, goods, charters and outposts should still bring. */
export function highsailValue(s: HighsailState, seat: number): number {
  const score = highsailScore(s, seat);
  if (s.over) return score;
  const roundsLeft = s.rounds - s.round;
  const scoringsLeft = s.scoringRounds.filter((r) => r >= s.round).length;
  const pool = s.resources[seat];
  const goods = ["timber", "crystal", "fuel"].reduce((sum, id) => sum + amountOf(pool, id), 0);
  const held = s.held[seat].reduce((sum, instance) => {
    const card = charterOf(instance);
    const cost = launchCost(s, seat, instance);
    const missing = total(shortfall(pool, cost)) / Math.max(1, total(cost));
    return sum + 0.45 * charterValue(card, roundsLeft, scoringsLeft) * (1 - 0.6 * missing);
  }, 0);
  const engine = s.launched[seat].reduce((sum, instance) => sum + incomeValue(charterOf(instance).income) * roundsLeft, 0);
  const crew = (s.workers[seat] + s.recruits[seat]) * roundsLeft * 1.1 + workersLeft(s, seat) * 0.2;
  return score + 0.9 * scoringsLeft * projectedIslands(s)[seat] + 0.45 * goods + 0.3 * amountOf(pool, "coins") + held + engine + crew + (s.nextFirst === seat ? 0.4 : 0);
}

/** Greedy Highsail player: tries every placement and keeps the one whose result looks best. */
export function highsailBot(): Bot {
  return ({ state, player, moves, rng }) => {
    const s = state as HighsailState;
    const sim = rng.fork();
    let best = moves[0] as HighsailMove;
    let bestValue = -Infinity;
    for (const move of moves as HighsailMove[]) {
      const value = highsailValue(highsail.applyMove(s, player, move, sim), player) + rng.next() * 0.05;
      if (value > bestValue) [best, bestValue] = [move, value];
    }
    return best;
  };
}
