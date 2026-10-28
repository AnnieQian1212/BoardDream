import type { CardView, GameModule, Geometry, GeometryCell, GeometryPiece, Panel, PlayerId, Rng } from "@boarddream/engine";
import { deal } from "../mechanics/deck";
import { applyEffects, buildDeck, defId, endgameScore, rulesText, type CardDef, type EffectSeat } from "../mechanics/effects";
import { majorityAwards, scoreRegions, type Presence } from "../mechanics/majority";
import { refill, take, type Market } from "../mechanics/market";
import { add, amountOf, canAfford, pay, total, type Amounts } from "../mechanics/resources";
import * as scoring from "../mechanics/scoring";
import { seatOrder } from "../mechanics/turns";
import { nextToPlace, occupants, openSpaces, place, placedBy, type ActionSpace, type Placements } from "../mechanics/workers";
import { HIGHSAIL_CHARTERS, HIGHSAIL_RESOURCES, ISLANDS, type Island } from "./highsail-cards";

const CHARTERS = new Map(HIGHSAIL_CHARTERS.map((card) => [card.id, card]));
export const charterOf = (instance: string): CardDef => CHARTERS.get(defId(instance))!;
/** The island a charter's outpost goes to: its first tag. */
export const islandOf = (instance: string): Island => ISLANDS.find((island) => island.id === charterOf(instance).tags[0])!;
const NAMES = Object.fromEntries(HIGHSAIL_RESOURCES.map((r) => [r.id, r.name.toLowerCase()]));

const MAX_WORKERS = 5;
const OUTPOSTS = 12;
export const OUTPOST_COST: Amounts = { timber: 1, fuel: 1, coins: 1 };
export const RECRUIT_COST: Amounts = { coins: 4 };
/** Leftover resources are worth a point per this many at the end. */
const LEFTOVER_RATE = 4;

export type SpaceId = "forest" | "mine" | "refinery" | "exchange" | "salvage" | "tavern" | "charter" | "shipyard" | "survey" | "admiralty" | "academy";

interface SpaceDef extends ActionSpace {
  id: SpaceId;
  label: string;
  gain?: Amounts;
}

/** The action spaces, with room for the player count: busy spaces open a second slot in bigger games. */
export function spacesFor(numPlayers: number): SpaceDef[] {
  const busy = numPlayers >= 3 ? 2 : 1;
  return [
    { id: "forest", label: "Timber +3", capacity: numPlayers >= 4 ? 2 : 1, gain: { timber: 3 } },
    { id: "mine", label: "Crystal +2", capacity: 1, gain: { crystal: 2 } },
    { id: "refinery", label: "Fuel +2", capacity: numPlayers >= 4 ? 2 : 1, gain: { fuel: 2 } },
    { id: "exchange", label: "Coins +3", capacity: 1, gain: { coins: 3 } },
    { id: "salvage", label: "Each good +1", capacity: 1, gain: { timber: 1, crystal: 1, fuel: 1 } },
    { id: "tavern", label: "Coins +1", gain: { coins: 1 } },
    { id: "charter", label: "Take charter", capacity: busy },
    { id: "shipyard", label: "Launch", capacity: busy },
    { id: "survey", label: "Outpost", capacity: 1 },
    { id: "admiralty", label: "Go first +1", capacity: 1, gain: { coins: 1 } },
    { id: "academy", label: "Recruit", capacity: 1 },
  ];
}

type HighsailParams = { rounds: number; startWorkers: number; rowSize: number; handLimit: number };

export interface HighsailState {
  numPlayers: number;
  rounds: number;
  round: number;
  /** Rounds after which the islands score: the middle one and the last. */
  scoringRounds: number[];
  rowSize: number;
  handLimit: number;
  first: PlayerId;
  /** Whoever took the Admiralty goes first next round. */
  nextFirst?: PlayerId;
  toMove: PlayerId;
  workers: number[];
  /** Crew recruited this round, joining next round. */
  recruits: number[];
  placed: Placements;
  resources: Amounts[];
  /** Points scored so far: launched charters and island scorings. */
  points: number[];
  held: string[][];
  launched: string[][];
  /** Island id to each seat's outposts there. */
  outposts: Presence;
  charters: Market<string>;
  /** What each seat scored at the latest island scoring. */
  lastScoring?: { round: number; points: number[] };
  over: boolean;
}

export type HighsailMove = { type: "place"; space: SpaceId; card?: string; island?: string };

const sameMove = (a: HighsailMove, b: HighsailMove) => a.space === b.space && a.card === b.card && a.island === b.island;

export const workersLeft = (s: HighsailState, seat: PlayerId) => s.workers[seat] - placedBy(s.placed, seat);
export const outpostsLeft = (s: HighsailState, seat: PlayerId) => OUTPOSTS - Object.values(s.outposts).reduce((sum, counts) => sum + counts[seat], 0);

/** Second place scores only with three or more players. */
export const islandAwards = (island: Island, numPlayers: number): number[] => (numPlayers >= 3 ? island.awards : [island.awards[0]]);

const effectSeat = (s: HighsailState, seat: PlayerId): EffectSeat => ({
  resources: s.resources[seat],
  points: s.points[seat],
  hand: s.held[seat],
  tableau: s.launched[seat],
});
// Charters never draw cards, so effects need no deck.
const EFFECTS = { cardOf: charterOf, draw: () => [] };

/** A seat's score as the table shows it: points so far, end-game bonuses and leftover resources. */
export function highsailScore(s: HighsailState, seat: PlayerId): number {
  return endgameScore(effectSeat(s, seat), charterOf) + Math.floor(total(s.resources[seat]) / LEFTOVER_RATE);
}

/** Pays every island's majority awards. */
function scoreIslands(s: HighsailState): HighsailState {
  const awards = scoreRegions(s.outposts, (id) => islandAwards(ISLANDS.find((i) => i.id === id)!, s.numPlayers), s.numPlayers);
  return { ...s, points: s.points.map((p, seat) => p + awards[seat]), lastScoring: { round: s.round, points: awards } };
}

/** Income, island scoring when due, then crews come home and the next round begins. */
function endRound(s: HighsailState, rng: Rng): HighsailState {
  let next = s;
  const resources = s.resources.slice();
  const points = s.points.slice();
  for (let seat = 0; seat < s.numPlayers; seat++) {
    let seatState = effectSeat(s, seat);
    for (const card of s.launched[seat]) seatState = applyEffects(seatState, charterOf(card).income, EFFECTS);
    resources[seat] = seatState.resources;
    points[seat] = seatState.points;
  }
  next = { ...next, resources, points };
  if (s.scoringRounds.includes(s.round)) next = scoreIslands(next);
  if (s.round >= s.rounds) return { ...next, over: true, placed: {} };

  // The oldest charter in the row leaves, so the offer keeps moving.
  const [oldest, ...rest] = next.charters.row;
  const charters = refill(rng, { ...next.charters, row: rest, discard: oldest === undefined ? next.charters.discard : [...next.charters.discard, oldest] }, s.rowSize);
  // The Admiralty decides who goes first; otherwise the trailing seat does, so nobody stays behind
  // in turn order (ties go to the earliest seat after this round's first player).
  const order = seatOrder((s.first + 1) % s.numPlayers, s.numPlayers);
  const trailing = order.reduce((low, seat) => (highsailScore(next, seat) < highsailScore(next, low) ? seat : low));
  const first = s.nextFirst ?? trailing;
  return {
    ...next,
    round: s.round + 1,
    first,
    nextFirst: undefined,
    toMove: first,
    workers: s.workers.map((n, seat) => n + s.recruits[seat]),
    recruits: s.recruits.map(() => 0),
    placed: {},
    charters,
  };
}

/** Board layout: action spaces on the left, the five islands on the right. */
const SPACE_W = 2.6;
const SPACE_H = 2.2;
const spaceAt = (index: number): [number, number] => [0.4 + (index % 3) * (SPACE_W + 0.2), 0.5 + Math.floor(index / 3) * (SPACE_H + 0.2)];
const ISLAND_AT: Record<string, [number, number]> = {
  ironcrag: [13.4, 2.0],
  mistwood: [10.5, 4.1],
  emberfall: [16.3, 4.1],
  saltspire: [11.6, 7.9],
  lowhaven: [15.2, 7.9],
};
const ISLAND_R = 1.6;
/** Outposts sit in rows of six, two under the island's name and then two above it. */
const outpostSpot = ([cx, cy]: [number, number], slot: number): [number, number] => [
  cx + ((slot % 6) - 2.5) * 0.34,
  cy + [0.42, 0.8, -0.5, -0.88][Math.floor(slot / 6) % 4],
];
const hexagon = ([cx, cy]: [number, number], r: number): [number, number][] =>
  Array.from({ length: 6 }, (_, i) => [cx + r * Math.cos((Math.PI / 3) * i), cy + r * Math.sin((Math.PI / 3) * i)] as [number, number]);
const rect = (x: number, y: number, w: number, h: number): [number, number][] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
const SPACE_ORDER: SpaceId[] = ["forest", "mine", "refinery", "exchange", "salvage", "tavern", "charter", "shipyard", "survey", "admiralty", "academy"];

function charterView(instance: string): CardView {
  const card = charterOf(instance);
  const effects = rulesText(card, NAMES, { onPlay: "Launch", income: "Each round", endgame: "Game end" });
  return {
    id: instance,
    title: card.name,
    text: `Outpost on ${islandOf(instance).name}.${effects ? ` ${effects}` : ""}`,
    cost: card.cost,
    points: card.points,
    tags: [card.tags[1], card.tags[0]],
  };
}

/**
 * Highsail: rival airship houses trade between five sky islands. Each round players take turns
 * sending crew to action spaces on the skyport (a taken space is blocked), gathering timber, crystal,
 * fuel and coins, taking charters and launching them. A launched charter scores, may pay income
 * every round or points at the end, and plants an outpost on its island. After the middle round and
 * the last, every island pays its majority. Highest score wins.
 */
export const highsail: GameModule<HighsailState, HighsailMove, HighsailParams> = {
  meta: {
    id: "highsail",
    name: "Highsail",
    family: "engine",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 4,
    summary: "Send airship crews around a skyport, launch charters between five sky islands and win their majorities.",
    rules: [
      "Each round, take turns sending one crew member to an open action space; most spaces hold one crew, so taking a space blocks it until the next round.",
      "Gather timber, crystal, fuel and coins; take charters (hold up to 3) and launch one at the shipyard by paying its cost.",
      "A launched charter scores its points and puts an outpost on its island. Survey charters pay income every round; envoy charters score at the end.",
      "Build an outpost directly for timber, fuel and a coin. After the middle round and the last, each island pays its most outposts, and with 3+ players second place too.",
      "Recruit crew for 4 coins (up to 5); the Admiralty makes you first next round. Every 4 leftover resources score 1 point; highest score wins.",
    ],
    resources: HIGHSAIL_RESOURCES,
  },
  params: [
    { key: "rounds", label: "Rounds", kind: "int", min: 4, max: 8, default: 6 },
    { key: "startWorkers", label: "Starting crew", kind: "int", min: 2, max: 4, default: 3 },
    { key: "rowSize", label: "Charters on offer", kind: "int", min: 3, max: 5, default: 4 },
    { key: "handLimit", label: "Charters held", kind: "int", min: 2, max: 4, default: 3 },
  ],

  setup: ({ numPlayers, params, rng }) => {
    const deck = rng.shuffle(buildDeck(HIGHSAIL_CHARTERS));
    // Everyone starts with one charter. The first seat gets a fourth coin: in bot-vs-bot play it
    // otherwise wins least often (late seats pick last in round 1 but lead the catch-up order).
    const { hands, rest } = deal(deck, numPlayers, 1);
    const charters = refill(rng, { row: [], drawPile: rest, discard: [] }, params.rowSize);
    return {
      numPlayers,
      rounds: params.rounds,
      round: 1,
      scoringRounds: [Math.ceil(params.rounds / 2), params.rounds],
      rowSize: params.rowSize,
      handLimit: params.handLimit,
      first: 0,
      toMove: 0,
      workers: new Array(numPlayers).fill(params.startWorkers),
      recruits: new Array(numPlayers).fill(0),
      placed: {},
      resources: Array.from({ length: numPlayers }, (_, seat) => ({ timber: 1, crystal: 1, fuel: 1, coins: seat === 0 ? 4 : 3 })),
      points: new Array(numPlayers).fill(0),
      held: hands,
      launched: Array.from({ length: numPlayers }, () => []),
      outposts: Object.fromEntries(ISLANDS.map((island) => [island.id, new Array(numPlayers).fill(0)])),
      charters,
      over: false,
    };
  },

  activePlayers: (s) => (s.over ? [] : [s.toMove]),

  legalMoves(s, player) {
    if (s.over || player !== s.toMove) return [];
    const pool = s.resources[player];
    const moves: HighsailMove[] = [];
    for (const space of openSpaces(spacesFor(s.numPlayers), s.placed, player)) {
      switch (space.id) {
        case "charter":
          if (s.held[player].length < s.handLimit) for (const card of s.charters.row) moves.push({ type: "place", space: space.id, card });
          break;
        case "shipyard":
          for (const card of s.held[player]) if (canAfford(pool, charterOf(card).cost)) moves.push({ type: "place", space: space.id, card });
          break;
        case "survey":
          if (canAfford(pool, OUTPOST_COST) && outpostsLeft(s, player) > 0) for (const island of ISLANDS) moves.push({ type: "place", space: space.id, island: island.id });
          break;
        case "academy":
          if (canAfford(pool, RECRUIT_COST) && s.workers[player] + s.recruits[player] < MAX_WORKERS) moves.push({ type: "place", space: space.id });
          break;
        default:
          moves.push({ type: "place", space: space.id });
      }
    }
    return moves;
  },

  applyMove(s, player, move, rng) {
    if (!highsail.legalMoves(s, player).some((m) => sameMove(m, move))) throw new Error(`illegal move ${JSON.stringify(move)}`);
    const space = spacesFor(s.numPlayers).find((sp) => sp.id === move.space)!;
    let next: HighsailState = { ...s, placed: place(s.placed, move.space, player) };
    const resources = next.resources.slice();
    const setSeat = <K extends "held" | "launched" | "points" | "recruits">(key: K, value: HighsailState[K][number]) => {
      const list = next[key].slice() as HighsailState[K][number][];
      list[player] = value;
      next = { ...next, [key]: list };
    };
    if (space.gain) resources[player] = add(resources[player], space.gain);
    next = { ...next, resources };

    switch (move.space) {
      case "admiralty":
        next = { ...next, nextFirst: player };
        break;
      case "academy":
        resources[player] = pay(resources[player], RECRUIT_COST);
        setSeat("recruits", s.recruits[player] + 1);
        break;
      case "charter": {
        const { card, market } = take(rng, s.charters, s.charters.row.indexOf(move.card!), s.rowSize);
        next = { ...next, charters: market };
        setSeat("held", [...s.held[player], card]);
        break;
      }
      case "shipyard": {
        const card = charterOf(move.card!);
        resources[player] = pay(resources[player], card.cost);
        setSeat("held", s.held[player].filter((c) => c !== move.card));
        setSeat("launched", [...s.launched[player], move.card!]);
        setSeat("points", s.points[player] + card.points);
        const island = islandOf(move.card!).id;
        if (outpostsLeft(next, player) > 0) next = { ...next, outposts: { ...next.outposts, [island]: next.outposts[island].map((n, seat) => (seat === player ? n + 1 : n)) } };
        const played = applyEffects({ ...effectSeat(next, player), resources: resources[player] }, card.onPlay, EFFECTS);
        resources[player] = played.resources;
        setSeat("points", played.points);
        break;
      }
      case "survey":
        resources[player] = pay(resources[player], OUTPOST_COST);
        next = { ...next, outposts: { ...next.outposts, [move.island!]: next.outposts[move.island!].map((n, seat) => (seat === player ? n + 1 : n)) } };
        break;
    }
    next = { ...next, resources };

    const following = nextToPlace(seatOrder(next.first, next.numPlayers), player, (seat) => workersLeft(next, seat));
    return following === undefined ? endRound(next, rng) : { ...next, toMove: following };
  },

  isTerminal: (s) => s.over,

  outcome(s) {
    const scores = Array.from({ length: s.numPlayers }, (_, seat) => highsailScore(s, seat));
    return { winners: s.over ? scoring.scoreWinners(scores) : [], scores };
  },

  geometry(s): Geometry {
    const spaces = spacesFor(s.numPlayers);
    const cells: GeometryCell[] = [];
    const pieces: GeometryPiece[] = [];
    SPACE_ORDER.forEach((id, index) => {
      const [x, y] = spaceAt(index);
      const space = spaces.find((sp) => sp.id === id)!;
      cells.push({ id: `space-${id}`, polygon: rect(x, y, SPACE_W, SPACE_H), kind: "skyport", label: space.label });
      occupants(s.placed, id).forEach((seat, i) => {
        const slots = Math.max(space.capacity ?? 4, 1);
        const step = SPACE_W / (Math.min(slots, 4) + 1);
        pieces.push({ id: `crew-${id}-${i}`, x: x + step * ((i % 4) + 1), y: y + SPACE_H - 0.5 - 0.5 * Math.floor(i / 4), r: 0.24, owner: seat, shape: "pawn", kind: "crew", cellId: `space-${id}` });
      });
    });
    const [rx, ry] = spaceAt(SPACE_ORDER.length);
    cells.push({ id: "round", polygon: rect(rx, ry, SPACE_W, SPACE_H), kind: "label", label: s.over ? "Final" : `Round ${s.round}/${s.rounds}` });
    for (const island of ISLANDS) {
      const at = ISLAND_AT[island.id];
      const awards = islandAwards(island, s.numPlayers);
      cells.push({ id: `island-${island.id}`, polygon: hexagon(at, ISLAND_R), kind: island.id, label: island.name });
      // What the island pays, printed on the board just below it.
      const below = at[1] + ISLAND_R * 0.87 + 0.08;
      cells.push({ id: `awards-${island.id}`, polygon: rect(at[0] - 0.8, below, 1.6, 0.45), kind: "label", label: `${awards.join(" / ")} pts` });
      let slot = 0;
      s.outposts[island.id].forEach((count, seat) => {
        for (let n = 0; n < count; n++, slot++) {
          const [x, y] = outpostSpot(at, slot);
          pieces.push({ id: `outpost-${island.id}-${slot}`, x, y, r: 0.15, owner: seat, shape: "square", kind: "outpost", cellId: `island-${island.id}` });
        }
      });
    }
    return { width: 18, height: 10.2, cells, pieces };
  },

  panels(s, viewer) {
    const scoringText = `islands score after rounds ${s.scoringRounds.join(" and ")}`;
    const panels: Panel[] = [
      {
        id: "office",
        title: "Charter office",
        zone: "shared",
        cards: s.charters.row.map(charterView),
        counters: [{ id: "charter-deck", label: "Deck", value: s.charters.drawPile.length }],
        note: s.lastScoring ? `Round ${s.lastScoring.round} scoring: ${s.lastScoring.points.map((p, seat) => `P${seat + 1} +${p}`).join(", ")}` : scoringText,
      },
    ];
    for (let seat = 0; seat < s.numPlayers; seat++) {
      panels.push({
        id: `seat${seat}`,
        title: `Player ${seat + 1}`,
        zone: "players",
        owner: seat,
        counters: [
          ...HIGHSAIL_RESOURCES.map((r) => ({ id: `seat${seat}-${r.id}`, label: r.name, value: amountOf(s.resources[seat], r.id), resource: r.id })),
          { id: `seat${seat}-crew`, label: "Crew", value: workersLeft(s, seat) },
          { id: `seat${seat}-held`, label: "Charters", value: s.held[seat].length },
          { id: `seat${seat}-score`, label: "Score", value: highsailScore(s, seat) },
        ],
        cards: s.launched[seat].map(charterView),
        note: s.first === seat && !s.over ? "First player" : undefined,
      });
    }
    if (viewer !== undefined) panels.push({ id: `hand${viewer}`, title: "Your charters", zone: "hand", owner: viewer, cards: s.held[viewer].map(charterView) });
    return panels;
  },

  moveTarget(_s, move) {
    if (move.space === "charter" || move.space === "shipyard") return move.card;
    if (move.space === "survey") return `island-${move.island}`;
    return `space-${move.space}`;
  },

  describeMove(s, move) {
    switch (move.space) {
      case "charter":
        return `take the ${charterOf(move.card!).name} charter`;
      case "shipyard": {
        const card = charterOf(move.card!);
        return `launch ${card.name} to ${islandOf(move.card!).name} (+${card.points})`;
      }
      case "survey":
        return `build an outpost on ${ISLANDS.find((i) => i.id === move.island)!.name}`;
      case "academy":
        return "recruit a crew member for 4 coins";
      case "admiralty":
        return "take the Admiralty: first next round, +1 coin";
      default: {
        const space = spacesFor(s.numPlayers).find((sp) => sp.id === move.space)!;
        return `send crew to ${space.label}`;
      }
    }
  },
};

/** Majority awards each seat would get if the islands scored now. */
export const projectedIslands = (s: HighsailState): number[] =>
  ISLANDS.reduce(
    (sum, island) => majorityAwards(s.outposts[island.id], islandAwards(island, s.numPlayers)).map((p, seat) => sum[seat] + p),
    new Array<number>(s.numPlayers).fill(0),
  );

