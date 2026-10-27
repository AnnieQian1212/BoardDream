import type { CardView, GameModule, Panel, PlayerId } from "@boarddream/engine";
import { applyEffects, buildDeck, defId, endgameScore, rulesText, type EffectContext, type EffectSeat } from "../mechanics/effects";
import * as market from "../mechanics/market";
import { add, amountOf, canAfford, pay } from "../mechanics/resources";
import * as scoring from "../mechanics/scoring";
import { GLASSHOUSE_CARDS, GLASSHOUSE_RESOURCES } from "./glasshouse-cards";

type GlasshouseParams = { turns: number; marketSize: number; handLimit: number };

export interface GlasshouseState {
  numPlayers: number;
  /** Turns each player gets. */
  turns: number;
  marketSize: number;
  handLimit: number;
  seats: EffectSeat[];
  market: market.Market<string>;
  toMove: PlayerId;
  turnsTaken: number;
}

export type GlasshouseMove =
  | { type: "gather"; resource: string }
  | { type: "plant"; card: string }
  | { type: "take"; card: string }
  | { type: "draw" }
  | { type: "harvest" };

const GATHER = 2;
const START_HAND = 3;

const byId = new Map(GLASSHOUSE_CARDS.map((card) => [card.id, card]));
export const glasshouseCard = (instance: string) => byId.get(defId(instance))!;
const NAMES = Object.fromEntries(GLASSHOUSE_RESOURCES.map((r) => [r.id, r.name.toLowerCase()]));

export const glasshouseScore = (seat: EffectSeat) => endgameScore(seat, glasshouseCard);

function cardView(instance: string): CardView {
  const card = glasshouseCard(instance);
  return {
    id: instance,
    title: card.name,
    text: rulesText(card, NAMES, { income: "Harvest", endgame: "Game end" }),
    cost: card.cost,
    points: card.points,
    tags: card.tags,
  };
}

/**
 * Glasshouse: grow a greenhouse whose plants feed each other. Each turn, take one action: gather
 * two of a resource, plant a card from your hand, take a card from the market or the deck, or
 * harvest to trigger every plant's income. Highest score after the last turn wins, counting each
 * plant's points and end-game bonuses.
 */
export const glasshouse: GameModule<GlasshouseState, GlasshouseMove, GlasshouseParams> = {
  meta: {
    id: "glasshouse",
    name: "Glasshouse",
    family: "engine",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 4,
    summary: "Grow a greenhouse whose plants feed each other; harvest your engine and score the best collection.",
    resources: GLASSHOUSE_RESOURCES,
  },
  params: [
    { key: "turns", label: "Turns per player", kind: "int", min: 8, max: 24, step: 2, default: 14 },
    { key: "marketSize", label: "Market size", kind: "int", min: 3, max: 6, default: 4 },
    { key: "handLimit", label: "Hand limit", kind: "int", min: 3, max: 8, default: 5 },
  ],

  setup: ({ numPlayers, params, rng }) => {
    let pile: market.Market<string> = { row: [], drawPile: rng.shuffle(buildDeck(GLASSHOUSE_CARDS)), discard: [] };
    const seats: EffectSeat[] = [];
    for (let p = 0; p < numPlayers; p++) {
      const dealt = market.drawBlind(rng, pile, START_HAND);
      pile = dealt.market;
      seats.push({ resources: { water: 1, light: 1, soil: 1 }, points: 0, hand: dealt.cards, tableau: [] });
    }
    return {
      numPlayers,
      turns: params.turns,
      marketSize: params.marketSize,
      handLimit: params.handLimit,
      seats,
      market: market.refill(rng, pile, params.marketSize),
      toMove: 0,
      turnsTaken: 0,
    };
  },

  activePlayers: (s) => (glasshouse.isTerminal(s) ? [] : [s.toMove]),

  legalMoves(s, player) {
    const seat = s.seats[player];
    const moves: GlasshouseMove[] = GLASSHOUSE_RESOURCES.map((r) => ({ type: "gather", resource: r.id }));
    for (const card of seat.hand) {
      if (canAfford(seat.resources, glasshouseCard(card).cost)) moves.push({ type: "plant", card });
    }
    if (seat.hand.length < s.handLimit) {
      for (const card of s.market.row) moves.push({ type: "take", card });
      if (s.market.drawPile.length + s.market.discard.length > 0) moves.push({ type: "draw" });
    }
    if (seat.tableau.some((card) => glasshouseCard(card).income?.length)) moves.push({ type: "harvest" });
    return moves;
  },

  applyMove(s, player, move, rng) {
    let pile = s.market;
    let seat = s.seats[player];
    const ctx: EffectContext = {
      cardOf: glasshouseCard,
      draw: (n) => {
        const dealt = market.drawBlind(rng, pile, n);
        pile = dealt.market;
        return dealt.cards;
      },
    };

    if (move.type === "gather") {
      seat = { ...seat, resources: add(seat.resources, { [move.resource]: GATHER }) };
    } else if (move.type === "plant") {
      const card = glasshouseCard(move.card);
      seat = {
        ...seat,
        resources: pay(seat.resources, card.cost),
        hand: seat.hand.filter((c) => c !== move.card),
        tableau: [...seat.tableau, move.card],
        points: seat.points + card.points,
      };
      seat = applyEffects(seat, card.onPlay, ctx);
    } else if (move.type === "take") {
      const taken = market.take(rng, pile, pile.row.indexOf(move.card), s.marketSize);
      pile = taken.market;
      seat = { ...seat, hand: [...seat.hand, taken.card] };
    } else if (move.type === "draw") {
      seat = { ...seat, hand: [...seat.hand, ...ctx.draw(1)] };
    } else {
      for (const card of seat.tableau) seat = applyEffects(seat, glasshouseCard(card).income, ctx);
    }

    return {
      ...s,
      seats: s.seats.map((old, p) => (p === player ? seat : old)),
      market: pile,
      toMove: (player + 1) % s.numPlayers,
      turnsTaken: s.turnsTaken + 1,
    };
  },

  isTerminal: (s) => s.turnsTaken >= s.turns * s.numPlayers,

  outcome: (s) => {
    const scores = s.seats.map(glasshouseScore);
    return { winners: scoring.scoreWinners(scores), scores };
  },

  // Other players' hands and the deck order are secret.
  view: (s, me) => ({
    ...s,
    seats: s.seats.map((seat, p) => (p === me ? seat : { ...seat, hand: seat.hand.map(() => "hidden") })),
    market: { row: s.market.row, drawPile: s.market.drawPile.map(() => "hidden"), discard: s.market.discard },
  }),

  panels(s, viewer) {
    const round = Math.min(s.turns, Math.floor(s.turnsTaken / s.numPlayers) + 1);
    const panels: Panel[] = [
      {
        id: "market",
        title: "Market",
        zone: "shared",
        cards: s.market.row.map(cardView),
        counters: [{ id: "deck", label: "Deck", value: s.market.drawPile.length + s.market.discard.length }],
        note: `Round ${round} of ${s.turns}`,
      },
      ...s.seats.map(
        (seat, p): Panel => ({
          id: `seat${p}`,
          title: `Player ${p + 1}`,
          zone: "players",
          owner: p,
          counters: [
            ...GLASSHOUSE_RESOURCES.map((r) => ({ id: `seat${p}-${r.id}`, label: r.name, value: amountOf(seat.resources, r.id), resource: r.id })),
            { id: `seat${p}-score`, label: "Score", value: glasshouseScore(seat) },
            { id: `seat${p}-hand`, label: "Hand", value: seat.hand.length },
          ],
          cards: seat.tableau.map(cardView),
        }),
      ),
    ];
    if (viewer !== undefined) {
      panels.push({ id: "hand", title: "Your hand", zone: "hand", owner: viewer, cards: s.seats[viewer].hand.map(cardView) });
    }
    return panels;
  },

  moveTarget(s, move) {
    if (move.type === "gather") return `seat${s.toMove}-${move.resource}`;
    if (move.type === "plant" || move.type === "take") return move.card;
    if (move.type === "draw") return "deck";
    return undefined;
  },

  describeMove(_s, move) {
    switch (move.type) {
      case "gather":
        return `gather ${GATHER} ${NAMES[move.resource]}`;
      case "plant":
        return `plant ${glasshouseCard(move.card).name}`;
      case "take":
        return `take ${glasshouseCard(move.card).name} from the market`;
      case "draw":
        return "draw from the deck";
      case "harvest":
        return "harvest";
    }
  },
};
