import { add, canAfford, formatAmounts, pay, type Amounts } from "./resources";

/**
 * Card effects as data. A game lists its cards as CardDefs; applyEffects plays them, endgameScore
 * scores them and rulesText writes their text, so what a card says and what it does cannot drift
 * apart. Generated games describe their cards in this language instead of writing code per card.
 */

export type Effect =
  | { gain: Amounts }
  | { draw: number }
  | { points: number }
  | { convert: { give: Amounts; get: Amounts } }
  | { gainPerTag: { tag: string; resource: string; amount: number } }
  | { pointsPerTag: { tag: string; points: number } };

export interface CardDef {
  id: string;
  name: string;
  cost: Amounts;
  /** Scored when the card is played. */
  points: number;
  tags: string[];
  /** When the card is played. */
  onPlay?: Effect[];
  /** Each time its owner activates their tableau (harvest, produce, ...). */
  income?: Effect[];
  /** At the end of the game. */
  endgame?: Effect[];
  /** Copies in the deck (default 1). */
  copies?: number;
}

/** What effects read and change: the card owner's resources, points, hand and played cards. */
export interface EffectSeat {
  resources: Amounts;
  points: number;
  hand: string[];
  tableau: string[];
}

export interface EffectContext {
  /** Card definition for a card instance id. */
  cardOf(instance: string): CardDef;
  /** Draws card instance ids from the shared deck. */
  draw(n: number): string[];
}

/** Card instance ids for a deck, one per copy: "mint#1", "mint#2", ... */
export function buildDeck(cards: readonly CardDef[]): string[] {
  return cards.flatMap((card) => Array.from({ length: card.copies ?? 1 }, (_, i) => `${card.id}#${i + 1}`));
}

/** The CardDef id behind an instance id. */
export const defId = (instance: string) => instance.split("#")[0];

export const countTag = (tableau: readonly string[], tag: string, cardOf: (instance: string) => CardDef) =>
  tableau.filter((card) => cardOf(card).tags.includes(tag)).length;

export function applyEffects(seat: EffectSeat, effects: readonly Effect[] | undefined, ctx: EffectContext): EffectSeat {
  let next = seat;
  for (const effect of effects ?? []) {
    if ("gain" in effect) {
      next = { ...next, resources: add(next.resources, effect.gain) };
    } else if ("draw" in effect) {
      next = { ...next, hand: [...next.hand, ...ctx.draw(effect.draw)] };
    } else if ("points" in effect) {
      next = { ...next, points: next.points + effect.points };
    } else if ("convert" in effect) {
      // Optional trades: skipped when the owner cannot pay.
      if (canAfford(next.resources, effect.convert.give)) {
        next = { ...next, resources: add(pay(next.resources, effect.convert.give), effect.convert.get) };
      }
    } else if ("gainPerTag" in effect) {
      const { tag, resource, amount } = effect.gainPerTag;
      next = { ...next, resources: add(next.resources, { [resource]: amount * countTag(next.tableau, tag, ctx.cardOf) }) };
    } else if ("pointsPerTag" in effect) {
      const { tag, points } = effect.pointsPerTag;
      next = { ...next, points: next.points + points * countTag(next.tableau, tag, ctx.cardOf) };
    }
  }
  return next;
}

/** Final score: points so far plus every end-game effect in the tableau. */
export function endgameScore(seat: EffectSeat, cardOf: (instance: string) => CardDef): number {
  const ctx: EffectContext = { cardOf, draw: () => [] };
  return seat.tableau.reduce((acc, card) => applyEffects(acc, cardOf(card).endgame, ctx), seat).points;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function describeEffect(effect: Effect, names: Record<string, string> = {}): string {
  if ("gain" in effect) return `gain ${formatAmounts(effect.gain, names)}`;
  if ("draw" in effect) return `draw ${plural(effect.draw, "card")}`;
  if ("points" in effect) return `+${plural(effect.points, "point")}`;
  if ("convert" in effect) return `trade ${formatAmounts(effect.convert.give, names)} for ${formatAmounts(effect.convert.get, names)}`;
  if ("gainPerTag" in effect) {
    const { tag, resource, amount } = effect.gainPerTag;
    return `gain ${amount} ${names[resource] ?? resource} per ${tag}`;
  }
  return `+${plural(effect.pointsPerTag.points, "point")} per ${effect.pointsPerTag.tag}`;
}

/** Rules text for a card, e.g. "When played: draw 1 card. Harvest: gain 1 water." */
export function rulesText(
  card: CardDef,
  names: Record<string, string> = {},
  labels: { onPlay?: string; income?: string; endgame?: string } = {},
): string {
  const { onPlay = "When played", income = "Income", endgame = "Game end" } = labels;
  const line = (label: string, effects?: Effect[]) =>
    effects?.length ? `${label}: ${effects.map((e) => describeEffect(e, names)).join(", ")}.` : "";
  return [line(onPlay, card.onPlay), line(income, card.income), line(endgame, card.endgame)].filter(Boolean).join(" ");
}

const EFFECT_KEYS = ["gain", "draw", "points", "convert", "gainPerTag", "pointsPerTag"];

/** Problems with a card list: unknown resources or effects, bad amounts, duplicate ids. */
export function validateCards(cards: readonly CardDef[], resourceIds: readonly string[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const checkAmounts = (where: string, amounts: Amounts) => {
    for (const [id, n] of Object.entries(amounts)) {
      if (!resourceIds.includes(id)) problems.push(`${where} uses unknown resource "${id}"`);
      if (!Number.isInteger(n) || n < 0) problems.push(`${where} has amount ${n} for "${id}"; use whole numbers ≥ 0`);
    }
  };
  for (const card of cards) {
    if (seen.has(card.id)) problems.push(`two cards use the id "${card.id}"`);
    seen.add(card.id);
    if (card.id.includes("#")) problems.push(`card id "${card.id}" must not contain "#"`);
    checkAmounts(`${card.id}.cost`, card.cost ?? {});
    if (!Number.isFinite(card.points)) problems.push(`${card.id}.points must be a number`);
    for (const trigger of ["onPlay", "income", "endgame"] as const) {
      for (const effect of card[trigger] ?? []) {
        const keys = Object.keys(effect);
        const where = `${card.id}.${trigger}`;
        if (keys.length !== 1 || !EFFECT_KEYS.includes(keys[0])) {
          problems.push(`${where} has an effect with keys [${keys.join(", ")}]; use exactly one of ${EFFECT_KEYS.join(", ")}`);
        } else if ("gain" in effect) checkAmounts(where, effect.gain);
        else if ("convert" in effect) {
          checkAmounts(where, effect.convert.give);
          checkAmounts(where, effect.convert.get);
        } else if ("gainPerTag" in effect && !resourceIds.includes(effect.gainPerTag.resource)) {
          problems.push(`${where} uses unknown resource "${effect.gainPerTag.resource}"`);
        }
      }
    }
  }
  return problems;
}
