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

/** A played card's standing order: whenever its owner plays another card with the tag, do the effects. */
export interface Trigger {
  tag: string;
  effects: Effect[];
}

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
  /**
   * While in its owner's tableau, fires when they play another card with the tag: the cards of a
   * tableau set each other off, so the order cards are played in matters.
   */
  whenever?: Trigger[];
  /** While in its owner's tableau, their cards with the tag cost this much less (never below zero). */
  discount?: { tag: string; amounts: Amounts };
  /** Copies in the deck (default 1). */
  copies?: number;
}

/** What effects read and change: the card owner's resources, points, hand and played cards. */
export interface EffectSeat {
  resources: Amounts;
  points: number;
  hand: string[];
  tableau: string[];
  /** The cards whose abilities fired last (playToTableau, applyIncome), for the table to flash. */
  fired?: string[];
  /** Counts the times abilities fired, so the same card firing twice in a row flashes twice. */
  firedAt?: number;
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

/**
 * A card's cost to its owner: its printed cost less every discount their tableau gives cards with
 * one of its tags, never below zero. Check affordability and pay with this, not the printed cost.
 */
export function costOf(card: CardDef, tableau: readonly string[], cardOf: (instance: string) => CardDef): Amounts {
  const cost: Amounts = { ...card.cost };
  for (const played of tableau) {
    const discount = cardOf(played).discount;
    if (!discount || !card.tags.includes(discount.tag)) continue;
    for (const [id, n] of Object.entries(discount.amounts)) if (cost[id] !== undefined) cost[id] = Math.max(0, cost[id] - n);
  }
  for (const id of Object.keys(cost)) if (cost[id] === 0) delete cost[id];
  return cost;
}

/**
 * Plays a card into its owner's tableau, after they have paid for it: it leaves their hand (if it
 * was there) and joins the end of their tableau, then its own onPlay effects apply, then the
 * standing orders (whenever) of every card already in their tableau that its tags set off, in the
 * order those were played; the seat records which cards fired. Triggers do not set each other off:
 * one play fires each matching card once per matching trigger.
 */
export function playToTableau(seat: EffectSeat, instance: string, ctx: EffectContext): EffectSeat {
  const card = ctx.cardOf(instance);
  const before = seat.tableau.filter((played) => played !== instance);
  const hand = seat.hand.filter((held) => held !== instance);
  let next = applyEffects({ ...seat, hand, tableau: [...before, instance] }, card.onPlay, ctx);
  const fired = [instance];
  for (const played of before) {
    for (const trigger of ctx.cardOf(played).whenever ?? []) {
      if (!card.tags.includes(trigger.tag)) continue;
      next = applyEffects(next, trigger.effects, ctx);
      if (!fired.includes(played)) fired.push(played);
    }
  }
  return { ...next, fired, firedAt: (seat.firedAt ?? 0) + 1 };
}

/** Every income effect in the seat's tableau, in the order played; the cards that paid are recorded as fired. */
export function applyIncome(seat: EffectSeat, ctx: EffectContext): EffectSeat {
  let next = seat;
  const fired: string[] = [];
  for (const played of seat.tableau) {
    const income = ctx.cardOf(played).income;
    if (!income?.length) continue;
    next = applyEffects(next, income, ctx);
    fired.push(played);
  }
  return { ...next, fired, firedAt: (seat.firedAt ?? 0) + 1 };
}

/** CardView.pulse for a card: set while it is among the seat's last fired cards, so the table flashes it. */
export function pulseOf(seat: Pick<EffectSeat, "fired" | "firedAt">, instance: string): number | undefined {
  return seat.fired?.includes(instance) ? seat.firedAt : undefined;
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

/**
 * Rules text for a card, e.g. "When played: draw 1 card. Harvest: gain 1 water. Whenever you play
 * a herb: gain 1 light. Your flower cards cost 1 water less." The play verb ("play", "launch")
 * and the cards' name ("cards", "charters") are the game's own words.
 */
export function rulesText(
  card: CardDef,
  names: Record<string, string> = {},
  labels: { onPlay?: string; income?: string; endgame?: string; play?: string; cards?: string } = {},
): string {
  const { onPlay = "When played", income = "Income", endgame = "Game end", play = "play", cards = "cards" } = labels;
  const list = (effects: readonly Effect[]) => effects.map((e) => describeEffect(e, names)).join(", ");
  const line = (label: string, effects?: Effect[]) => (effects?.length ? `${label}: ${list(effects)}.` : "");
  // Tags read as the game names them ("Ironcrag"), and the card noun as singular after "a".
  const tag = (id: string) => names[id] ?? id;
  const one = cards.replace(/s$/, "");
  const triggers = (card.whenever ?? []).map((t) => `Whenever you ${play} ${article(tag(t.tag))} ${tag(t.tag)} ${one}: ${list(t.effects)}.`);
  const discount = card.discount ? [`Your ${tag(card.discount.tag)} ${cards} cost ${formatAmounts(card.discount.amounts, names)} less.`] : [];
  return [line(onPlay, card.onPlay), line(income, card.income), ...triggers, ...discount, line(endgame, card.endgame)].filter(Boolean).join(" ");
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

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
    const lists: [string, readonly Effect[]][] = [
      ...(["onPlay", "income", "endgame"] as const).map((key): [string, readonly Effect[]] => [`${card.id}.${key}`, card[key] ?? []]),
      ...(card.whenever ?? []).map((t, i): [string, readonly Effect[]] => [`${card.id}.whenever[${i}]`, t.effects ?? []]),
    ];
    for (const [i, t] of (card.whenever ?? []).entries()) {
      if (typeof t.tag !== "string" || !t.tag) problems.push(`${card.id}.whenever[${i}] needs the tag that sets it off`);
    }
    if (card.discount) {
      if (typeof card.discount.tag !== "string" || !card.discount.tag) problems.push(`${card.id}.discount needs the tag of the cards it makes cheaper`);
      checkAmounts(`${card.id}.discount`, card.discount.amounts ?? {});
    }
    for (const [where, effects] of lists) {
      for (const effect of effects) {
        const keys = Object.keys(effect);
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
