import type { CardView, GameModule, Geometry, GeometryCell, GeometryPiece, Panel, PlayerId, ResourceSpec, Rng } from "@boarddream/engine";
import { buildHexMap, canRoad, canSettle, edgePolygon, lookup, radiusCoords, roadSpots, settleSpots, tilePolygon, vertexPolygon, type Buildings, type Roads } from "../mechanics/hexmap";
import { collect, cornerYield, flipEvent, produce, type EventDeck } from "../mechanics/production";
import { add, amountOf, canAfford, pay, type Amounts } from "../mechanics/resources";
import * as scoring from "../mechanics/scoring";
import { bankOptions, bankTrade, canAccept, settle, swapOptions, type Offer } from "../mechanics/trade";

export const LANTERN_RESOURCES: ResourceSpec[] = [
  { id: "wood", name: "Wood", icon: "tree", color: "#5f8f4e" },
  { id: "stone", name: "Stone", icon: "mountain", color: "#8a8d96" },
  { id: "grain", name: "Grain", icon: "wheat", color: "#d6a93a" },
  { id: "fish", name: "Fish", icon: "fish", color: "#3f8fc8" },
];
const RESOURCE_IDS = LANTERN_RESOURCES.map((r) => r.id);
const NAMES = Object.fromEntries(LANTERN_RESOURCES.map((r) => [r.id, r.name.toLowerCase()]));

export type Terrain = "forest" | "quarry" | "fields" | "reef" | "lagoon";
export const TERRAIN_RESOURCE: Record<Exclude<Terrain, "lagoon">, string> = { forest: "wood", quarry: "stone", fields: "grain", reef: "fish" };
const PRODUCING = Object.keys(TERRAIN_RESOURCE) as Exclude<Terrain, "lagoon">[];

export const COSTS = {
  road: { wood: 1, stone: 1 },
  village: { wood: 1, grain: 1, fish: 1 },
  town: { grain: 2, stone: 2 },
  lantern: { fish: 2, wood: 1, stone: 1 },
} satisfies Record<string, Amounts>;
export const PIECES = { road: 13, village: 5, town: 4 };
const LANTERN_POINTS = 2;

/** The island: a radius-2 hexagon of 19 tiles. */
export const LANTERN_MAP = buildHexMap(radiusCoords(2), 1, 0.6);

/** Tile terrains, top to bottom, for the fixed map. */
const BALANCED: Terrain[] = [
  ...["forest", "fields", "reef"],
  ...["quarry", "lagoon", "forest", "quarry"],
  ...["reef", "fields", "lagoon", "reef", "fields"],
  ...["forest", "quarry", "lagoon", "forest"],
  ...["fields", "reef", "quarry"],
] as Terrain[];
const BALANCED_RICH = [1, 10, 13];

type LanternParams = { target: number; maxRounds: number; bankRate: number; tradesPerTurn: number; tides: string; randomMap: boolean };

export interface LanternState {
  numPlayers: number;
  target: number;
  maxRounds: number;
  bankRate: number;
  /** Bank trades plus offers a seat may make per turn. */
  tradesPerTurn: number;
  /** "shuffled": tides come from a shuffled deck; "cycle": they rotate in a fixed order. */
  tides: "shuffled" | "cycle";
  /** By tile index in LANTERN_MAP.tiles. */
  terrain: Terrain[];
  rich: boolean[];
  buildings: Buildings;
  roads: Roads;
  /** Lagoon tile id to the seat that lit it. */
  lanterns: Record<string, PlayerId>;
  resources: Amounts[];
  phase: "setup" | "play" | "offer";
  /** Snake order of free placements; `settled` is the corner still waiting for its road. */
  setup: { order: PlayerId[]; step: number; settled?: string };
  toMove: PlayerId;
  round: number;
  tideDeck: EventDeck<Terrain>;
  tide?: Terrain;
  tidesFlipped: number;
  tradesLeft: number;
  offer?: Offer;
  winner?: PlayerId;
}

export type LanternMove =
  | { type: "settle"; vertex: string }
  | { type: "road"; edge: string }
  | { type: "village"; vertex: string }
  | { type: "town"; vertex: string }
  | { type: "lantern"; tile: string }
  | { type: "bank"; give: string; get: string }
  | { type: "offer"; to: PlayerId; give: string; get: string }
  | { type: "accept" }
  | { type: "decline" }
  | { type: "end" };

const tileIndex = new Map(LANTERN_MAP.tiles.map((t, i) => [t.id, i]));

// Cell outlines never change during a game, so they are computed once.
const OUTLINES = {
  tile: LANTERN_MAP.tiles.map((t) => tilePolygon(LANTERN_MAP, t.id)),
  edge: LANTERN_MAP.edges.map((e) => edgePolygon(LANTERN_MAP, e.id)),
  vertex: LANTERN_MAP.vertices.map((v) => vertexPolygon(LANTERN_MAP, v.id)),
};
export const terrainOf = (s: LanternState, tile: string) => s.terrain[tileIndex.get(tile)!];

/** What a tile gives each building level when its terrain's tide comes in. */
export function tileYield(s: LanternState, tile: string): Amounts | undefined {
  const i = tileIndex.get(tile)!;
  const terrain = s.terrain[i];
  if (terrain === "lagoon") return undefined;
  return { [TERRAIN_RESOURCE[terrain]]: s.rich[i] ? 2 : 1 };
}

export function lanternScore(s: LanternState, seat: PlayerId): number {
  const built = Object.values(s.buildings).filter((b) => b.owner === seat).reduce((sum, b) => sum + b.level, 0);
  return built + LANTERN_POINTS * Object.values(s.lanterns).filter((owner) => owner === seat).length;
}

export function piecesLeft(s: LanternState, seat: PlayerId) {
  const mine = Object.values(s.buildings).filter((b) => b.owner === seat);
  return {
    road: PIECES.road - Object.values(s.roads).filter((owner) => owner === seat).length,
    village: PIECES.village - mine.filter((b) => b.level === 1).length,
    town: PIECES.town - mine.filter((b) => b.level === 2).length,
  };
}

/** Lagoons a seat may light: unlit, with one of the seat's buildings on a corner. */
export function lanternSpots(s: LanternState, seat: PlayerId): string[] {
  return LANTERN_MAP.tiles
    .filter((t) => terrainOf(s, t.id) === "lagoon" && s.lanterns[t.id] === undefined && t.corners.some((v) => s.buildings[v]?.owner === seat))
    .map((t) => t.id);
}

const CYCLE: Terrain[] = ["forest", "quarry", "fields", "reef"];

/** Starts a seat's turn: the next tide comes in and every building next to that terrain produces. */
function beginTurn(s: LanternState, seat: PlayerId, rng: Rng): LanternState {
  let tideDeck = s.tideDeck;
  let tide: Terrain;
  if (s.tides === "cycle") tide = CYCLE[s.tidesFlipped % CYCLE.length];
  else ({ event: tide, deck: tideDeck } = flipEvent(rng, s.tideDeck));
  const tiles = LANTERN_MAP.tiles.filter((t) => terrainOf(s, t.id) === tide).map((t) => t.id);
  const gains = produce(LANTERN_MAP, s.buildings, tiles, (t) => tileYield(s, t), s.numPlayers);
  return {
    ...s,
    toMove: seat,
    tide,
    tideDeck,
    tidesFlipped: s.tidesFlipped + 1,
    resources: collect(s.resources, gains),
    tradesLeft: s.tradesPerTurn,
  };
}

function checkWin(s: LanternState, seat: PlayerId): LanternState {
  return lanternScore(s, seat) >= s.target ? { ...s, winner: seat } : s;
}

const setupSeat = (s: LanternState) => s.setup.order[s.setup.step];

/** Terrains around a corner, e.g. "forest, reef and lagoon". */
function cornerTerrains(s: LanternState, vertex: string): string {
  const names = lookup(LANTERN_MAP).vertex.get(vertex)!.tiles.map((t) => terrainOf(s, t));
  return names.length <= 1 ? (names[0] ?? "the sea") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * Lantern Isles: settle a small archipelago. Villages sit on the corners where islands meet and
 * roads run along their edges. Instead of dice, each turn a tide comes in from a shuffled tide deck
 * and every building next to that terrain produces (towns twice). Spend wood, stone, grain and fish
 * on roads, villages, towns and lanterns on the lagoons; up to three times a turn, trade 3:1 with the
 * bank or offer another player a one-for-one swap they may accept or decline. First to the target score wins; otherwise the highest
 * score when the rounds run out.
 */
export const lanternIsles: GameModule<LanternState, LanternMove, LanternParams> = {
  meta: {
    id: "lantern-isles",
    name: "Lantern Isles",
    family: "map",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 4,
    summary: "Settle an archipelago where the tides decide what each coast yields; trade, build and light the lagoons.",
    resources: LANTERN_RESOURCES,
  },
  params: [
    { key: "target", label: "Points to win", kind: "int", min: 7, max: 14, default: 10 },
    { key: "maxRounds", label: "Round limit", kind: "int", min: 15, max: 50, step: 5, default: 30 },
    { key: "bankRate", label: "Bank trade rate", kind: "int", min: 2, max: 4, default: 3 },
    { key: "tradesPerTurn", label: "Trades per turn", kind: "int", min: 1, max: 4, default: 3 },
    { key: "tides", label: "Tides", kind: "choice", options: ["shuffled", "cycle"], default: "shuffled" },
    { key: "randomMap", label: "Shuffle the islands", kind: "bool", default: true },
  ],

  setup: ({ numPlayers, params, rng }) => {
    let terrain = BALANCED;
    let rich = BALANCED.map((_, i) => BALANCED_RICH.includes(i));
    if (params.randomMap) {
      terrain = rng.shuffle(BALANCED);
      const producing = terrain.flatMap((t, i) => (t === "lagoon" ? [] : [i]));
      const picked = rng.shuffle(producing).slice(0, 3);
      rich = terrain.map((_, i) => picked.includes(i));
    }
    const order = [...Array.from({ length: numPlayers }, (_, p) => p), ...Array.from({ length: numPlayers }, (_, p) => numPlayers - 1 - p)];
    return {
      numPlayers,
      target: params.target,
      maxRounds: params.maxRounds,
      bankRate: params.bankRate,
      tradesPerTurn: params.tradesPerTurn,
      tides: params.tides === "cycle" ? "cycle" : "shuffled",
      terrain,
      rich,
      buildings: {},
      roads: {},
      lanterns: {},
      resources: Array.from({ length: numPlayers }, () => ({})),
      phase: "setup",
      setup: { order, step: 0 },
      toMove: 0,
      round: 0,
      tideDeck: { drawPile: rng.shuffle(PRODUCING.flatMap((t) => [t, t])), discard: [] },
      tidesFlipped: 0,
      tradesLeft: 0,
    };
  },

  activePlayers(s) {
    if (lanternIsles.isTerminal(s)) return [];
    if (s.phase === "setup") return [setupSeat(s)];
    if (s.phase === "offer") return [s.offer!.to];
    return [s.toMove];
  },

  legalMoves(s, player) {
    if (!lanternIsles.activePlayers(s).includes(player)) return [];
    if (s.phase === "setup") {
      if (s.setup.settled === undefined) {
        return settleSpots(LANTERN_MAP, s.buildings, s.roads, player, false).map((vertex) => ({ type: "settle", vertex }));
      }
      return lookup(LANTERN_MAP)
        .vertex.get(s.setup.settled)!
        .edges.filter((edge) => s.roads[edge] === undefined)
        .map((edge) => ({ type: "road", edge }));
    }
    if (s.phase === "offer") {
      return canAccept(s.resources, s.offer!) ? [{ type: "accept" }, { type: "decline" }] : [{ type: "decline" }];
    }

    const pool = s.resources[player];
    const left = piecesLeft(s, player);
    const moves: LanternMove[] = [];
    if (left.village > 0 && canAfford(pool, COSTS.village)) {
      for (const vertex of settleSpots(LANTERN_MAP, s.buildings, s.roads, player, true)) moves.push({ type: "village", vertex });
    }
    if (left.town > 0 && canAfford(pool, COSTS.town)) {
      for (const [vertex, b] of Object.entries(s.buildings)) if (b.owner === player && b.level === 1) moves.push({ type: "town", vertex });
    }
    if (canAfford(pool, COSTS.lantern)) for (const tile of lanternSpots(s, player)) moves.push({ type: "lantern", tile });
    if (left.road > 0 && canAfford(pool, COSTS.road)) {
      for (const edge of roadSpots(LANTERN_MAP, s.buildings, s.roads, player)) moves.push({ type: "road", edge });
    }
    if (s.tradesLeft > 0) {
      for (const { give, get } of bankOptions(pool, RESOURCE_IDS, s.bankRate)) moves.push({ type: "bank", give, get });
      for (let to = 0; to < s.numPlayers; to++) {
        if (to === player) continue;
        for (const offer of swapOptions(s.resources, player, to, RESOURCE_IDS)) {
          moves.push({ type: "offer", to, give: Object.keys(offer.give)[0], get: Object.keys(offer.get)[0] });
        }
      }
    }
    moves.push({ type: "end" });
    return moves;
  },

  applyMove(s, player, move, rng) {
    const pools = s.resources.slice();
    const spend = (cost: Amounts) => {
      pools[player] = pay(pools[player], cost);
    };

    switch (move.type) {
      case "settle": {
        if (!canSettle(LANTERN_MAP, s.buildings, s.roads, move.vertex, player, false)) throw new Error("illegal settle");
        // The second free village pays out its neighbors once.
        if (s.setup.step >= s.numPlayers) pools[player] = add(pools[player], cornerYield(LANTERN_MAP, move.vertex, (t) => tileYield(s, t)));
        return {
          ...s,
          buildings: { ...s.buildings, [move.vertex]: { owner: player, level: 1 } },
          resources: pools,
          setup: { ...s.setup, settled: move.vertex },
        };
      }
      case "road": {
        if (s.phase === "setup") {
          const spot = lookup(LANTERN_MAP).vertex.get(s.setup.settled ?? "");
          if (!spot?.edges.includes(move.edge) || s.roads[move.edge] !== undefined) throw new Error("illegal setup road");
          const step = s.setup.step + 1;
          const next: LanternState = { ...s, roads: { ...s.roads, [move.edge]: player }, setup: { ...s.setup, step, settled: undefined } };
          return step < s.setup.order.length ? next : beginTurn({ ...next, phase: "play", round: 1 }, 0, rng);
        }
        if (!canRoad(LANTERN_MAP, s.buildings, s.roads, move.edge, player)) throw new Error("illegal road");
        spend(COSTS.road);
        return { ...s, resources: pools, roads: { ...s.roads, [move.edge]: player } };
      }
      case "village": {
        if (!canSettle(LANTERN_MAP, s.buildings, s.roads, move.vertex, player, true)) throw new Error("illegal village");
        spend(COSTS.village);
        return checkWin({ ...s, resources: pools, buildings: { ...s.buildings, [move.vertex]: { owner: player, level: 1 } } }, player);
      }
      case "town": {
        if (s.buildings[move.vertex]?.owner !== player) throw new Error("illegal town");
        spend(COSTS.town);
        return checkWin({ ...s, resources: pools, buildings: { ...s.buildings, [move.vertex]: { owner: player, level: 2 } } }, player);
      }
      case "lantern": {
        if (!lanternSpots(s, player).includes(move.tile)) throw new Error("illegal lantern");
        spend(COSTS.lantern);
        return checkWin({ ...s, resources: pools, lanterns: { ...s.lanterns, [move.tile]: player } }, player);
      }
      case "bank":
        pools[player] = bankTrade(pools[player], move.give, move.get, s.bankRate);
        return { ...s, resources: pools, tradesLeft: s.tradesLeft - 1 };
      case "offer":
        return {
          ...s,
          phase: "offer",
          tradesLeft: s.tradesLeft - 1,
          offer: { from: player, to: move.to, give: { [move.give]: 1 }, get: { [move.get]: 1 } },
        };
      case "accept":
        return { ...s, phase: "play", resources: settle(s.resources, s.offer!), offer: undefined };
      case "decline":
        return { ...s, phase: "play", offer: undefined };
      case "end": {
        const next = (player + 1) % s.numPlayers;
        const round = next === 0 ? s.round + 1 : s.round;
        const moved = { ...s, round };
        return round > s.maxRounds ? moved : beginTurn(moved, next, rng);
      }
    }
  },

  isTerminal: (s) => s.winner !== undefined || s.round > s.maxRounds,

  outcome(s) {
    const scores = Array.from({ length: s.numPlayers }, (_, p) => lanternScore(s, p));
    return { winners: s.winner !== undefined ? [s.winner] : scoring.scoreWinners(scores), scores };
  },

  geometry(s): Geometry {
    const map = LANTERN_MAP;
    const cells: GeometryCell[] = map.tiles.map((t, i) => {
      const terrain = s.terrain[i];
      const label = terrain === "lagoon" ? "lagoon" : `${NAMES[TERRAIN_RESOURCE[terrain]]}${s.rich[i] ? " ×2" : ""}`;
      return { id: t.id, polygon: OUTLINES.tile[i], kind: terrain, label };
    });
    map.edges.forEach((e, i) => cells.push({ id: e.id, polygon: OUTLINES.edge[i], kind: "edge", owner: s.roads[e.id] }));
    map.vertices.forEach((v, i) => cells.push({ id: v.id, polygon: OUTLINES.vertex[i], kind: "vertex", owner: s.buildings[v.id]?.owner }));

    const { vertex, tile } = lookup(map);
    const pieces: GeometryPiece[] = Object.entries(s.buildings).map(([id, b]) => {
      const [x, y] = vertex.get(id)!.at;
      return b.level === 2
        ? { id: `b-${id}`, x, y, r: 0.22, owner: b.owner, shape: "square", kind: "town", cellId: id }
        : { id: `b-${id}`, x, y, r: 0.19, owner: b.owner, shape: "disc", kind: "village", cellId: id };
    });
    for (const [id, owner] of Object.entries(s.lanterns)) {
      const [x, y] = tile.get(id)!.center;
      pieces.push({ id: `l-${id}`, x, y: y + 0.3, r: 0.26, owner, shape: "disc", kind: "lantern", label: "✦", cellId: id });
    }
    return { width: map.width, height: map.height, cells, pieces };
  },

  panels(s) {
    const tideCard: CardView[] =
      s.tide && s.tide !== "lagoon"
        ? [
            {
              id: `tide${s.tidesFlipped}`,
              title: `${s.tide[0].toUpperCase()}${s.tide.slice(1)} tide`,
              text: `Buildings next to ${s.tide} gain ${NAMES[TERRAIN_RESOURCE[s.tide]]}; towns gain double.`,
              tags: [s.tide],
            },
          ]
        : [];
    const round = s.phase === "setup" ? "Setup: place a village and a road" : `Round ${Math.min(s.round, s.maxRounds)} of ${s.maxRounds}`;
    const panels: Panel[] = [
      {
        id: "tides",
        title: "Tides",
        zone: "shared",
        cards: tideCard,
        counters: [{ id: "tide-deck", label: "Tide deck", value: s.tides === "cycle" ? 0 : s.tideDeck.drawPile.length }],
        note: `${round} · first to ${s.target}`,
      },
    ];
    for (let p = 0; p < s.numPlayers; p++) {
      panels.push({
        id: `seat${p}`,
        title: `Player ${p + 1}`,
        zone: "players",
        owner: p,
        counters: [
          ...LANTERN_RESOURCES.map((r) => ({ id: `seat${p}-${r.id}`, label: r.name, value: amountOf(s.resources[p], r.id), resource: r.id })),
          { id: `seat${p}-score`, label: "Score", value: lanternScore(s, p) },
        ],
        note: s.offer && s.offer.to === p ? `Offer from P${s.offer.from + 1}: ${tradeText(s.offer)}` : undefined,
      });
    }
    return panels;
  },

  moveTarget(s, move) {
    switch (move.type) {
      case "settle":
      case "village":
      case "town":
        return move.vertex;
      case "road":
        return move.edge;
      case "lantern":
        return move.tile;
      case "bank":
        // Click the resource you want on your own mat.
        return `seat${s.toMove}-${move.get}`;
      case "offer":
        // Click the resource you want on the other player's mat.
        return `seat${move.to}-${move.get}`;
      default:
        return undefined;
    }
  },

  describeMove(s, move) {
    switch (move.type) {
      case "settle":
        return `settle by ${cornerTerrains(s, move.vertex)}`;
      case "road":
        return s.phase === "setup" ? "lay a free road" : "build a road";
      case "village":
        return `build a village by ${cornerTerrains(s, move.vertex)}`;
      case "town":
        return `upgrade the village by ${cornerTerrains(s, move.vertex)} to a town`;
      case "lantern":
        return "light a lantern on a lagoon";
      case "bank":
        return `trade ${s.bankRate} ${NAMES[move.give]} to the bank for 1 ${NAMES[move.get]}`;
      case "offer":
        return `offer P${move.to + 1} 1 ${NAMES[move.give]} for 1 ${NAMES[move.get]}`;
      case "accept":
        return s.offer ? `accept ${tradeText(s.offer)}` : "accept the trade";
      case "decline":
        return "decline the trade";
      case "end":
        return "end turn";
    }
  },
};

function tradeText(offer: Offer): string {
  const one = (a: Amounts) => {
    const [id, n] = Object.entries(a)[0];
    return `${n} ${NAMES[id] ?? id}`;
  };
  return `${one(offer.give)} for ${one(offer.get)}`;
}
