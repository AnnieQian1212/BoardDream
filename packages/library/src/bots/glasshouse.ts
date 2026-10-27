import type { Bot } from "@boarddream/engine";
import type { CardDef, Effect, EffectSeat } from "../mechanics/effects";
import { glasshouseCard, type GlasshouseMove, type GlasshouseState } from "../games/glasshouse";
import { shortfall, total } from "../mechanics/resources";

/** Rough worth of one effect, in points. */
function effectValue(effect: Effect, seat: EffectSeat): number {
  if ("gain" in effect) return total(effect.gain) * 0.6;
  if ("draw" in effect) return effect.draw * 0.8;
  if ("points" in effect) return effect.points;
  if ("convert" in effect) return (total(effect.convert.get) - total(effect.convert.give)) * 0.6;
  if ("gainPerTag" in effect) {
    const tagged = seat.tableau.filter((c) => glasshouseCard(c).tags.includes(effect.gainPerTag.tag)).length;
    return (tagged + 1) * effect.gainPerTag.amount * 0.6;
  }
  const tagged = seat.tableau.filter((c) => glasshouseCard(c).tags.includes(effect.pointsPerTag.tag)).length;
  return (tagged + 2) * effect.pointsPerTag.points;
}

/** Points now, plus income over the turns left, plus what play and end-game effects should bring. */
function cardValue(card: CardDef, seat: EffectSeat, turnsLeft: number): number {
  const sum = (effects?: Effect[]) => (effects ?? []).reduce((acc, e) => acc + effectValue(e, seat), 0);
  const harvests = Math.max(0, turnsLeft - 1) / 3;
  return card.points + sum(card.onPlay) + sum(card.income) * harvests + sum(card.endgame) - total(card.cost) * 0.25;
}

/**
 * Greedy Glasshouse player: plants the best card it can afford, harvests when its engine pays, saves
 * up for the best card in hand, and otherwise picks up the best card on offer.
 */
export function glasshouseBot(): Bot {
  return ({ state, player, moves, rng }) => {
    const view = state as GlasshouseState;
    const seat = view.seats[player];
    const options = moves as GlasshouseMove[];
    const turnsLeft = view.turns - Math.floor(view.turnsTaken / view.numPlayers);
    const value = (instance: string) => cardValue(glasshouseCard(instance), seat, turnsLeft) + rng.next() * 0.1;
    const best = <M extends GlasshouseMove>(list: M[], score: (m: M) => number) =>
      list.reduce((a, b) => (score(b) > score(a) ? b : a));

    const plants = options.filter((m): m is Extract<GlasshouseMove, { type: "plant" }> => m.type === "plant");
    if (plants.length > 0) return best(plants, (m) => value(m.card));

    const harvest = options.find((m) => m.type === "harvest");
    const harvestValue = seat.tableau.reduce(
      (acc, c) => acc + (glasshouseCard(c).income ?? []).reduce((sum, e) => sum + effectValue(e, seat), 0),
      0,
    );
    if (harvest && harvestValue >= 1.8) return harvest;

    // Save up for the best card in hand that is within reach.
    const target = seat.hand.length > 0 ? seat.hand.reduce((a, b) => (value(b) > value(a) ? b : a)) : undefined;
    if (target && total(shortfall(seat.resources, glasshouseCard(target).cost)) <= 4) {
      const missing = Object.entries(shortfall(seat.resources, glasshouseCard(target).cost)).sort((a, b) => b[1] - a[1]);
      const gather = options.find((m) => m.type === "gather" && m.resource === missing[0]?.[0]);
      if (gather) return gather;
    }

    const takes = options.filter((m): m is Extract<GlasshouseMove, { type: "take" }> => m.type === "take");
    if (takes.length > 0) return best(takes, (m) => value(m.card));
    const draw = options.find((m) => m.type === "draw");
    if (draw) return draw;
    if (harvest) return harvest;

    // Nothing better: gather whatever we hold least of.
    const gathers = options.filter((m): m is Extract<GlasshouseMove, { type: "gather" }> => m.type === "gather");
    return best(gathers, (m) => -(seat.resources[m.resource] ?? 0));
  };
}
