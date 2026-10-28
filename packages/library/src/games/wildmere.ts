import type { GameModule, Geometry, GeometryCell, GeometryPiece, Panel, PlayerId } from "@boarddream/engine";
import { majorityAwards } from "../mechanics/majority";
import * as scoring from "../mechanics/scoring";
import { fit, frontier, hexBoard, regionIndex, regions, rotate, segmentPoint, segments, type Layout, type Region, type TileBoard } from "../mechanics/tiles";
import { START_TILE, TERRAINS, WILDMERE_RESOURCES, WILDMERE_TILES } from "./wildmere-tiles";

/** Funds to station a ranger, and how many tiles' worth of presence it adds. */
export const RANGER_COST = 2;
export const RANGER_WEIGHT = 2;
/** Leftover funds are worth a point per this many at the end. */
const FUND_RATE = 3;
/** Cap on rotations in one turn, so every turn ends. */
const MAX_TURNS = 12;
const HEX = 0.5;

const BOARDS = new Map<number, TileBoard>();
export const boardFor = (radius: number): TileBoard => {
  if (!BOARDS.has(radius)) BOARDS.set(radius, hexBoard(radius, HEX));
  return BOARDS.get(radius)!;
};
const CENTER = "0,0";
const terrainName = (id: string) => TERRAINS.find((t) => t.id === id)?.name ?? id;

type WildmereParams = { radius: number; marketSize: number; rangers: number };

interface Tile {
  edges: string[];
  /** Who placed it; the starting tile has no owner. */
  owner?: PlayerId;
}

export interface Ranger {
  owner: PlayerId;
  cell: string;
  /** Any side of the segment it stands on. */
  side: number;
}

export interface WildmereState {
  numPlayers: number;
  radius: number;
  marketSize: number;
  placed: Layout<Tile>;
  /** Tiles still to come out, as indices into WILDMERE_TILES; the market draws from the front. */
  supply: number[];
  /** Face-up tiles with the funds left on them by players who skipped them. */
  market: { tile: number; funds: number }[];
  toMove: PlayerId;
  phase: "take" | "place" | "ranger";
  /** The tile being placed, as taken from the market, turned `rotation` sides clockwise. */
  held?: { tile: number; rotation: number; turns: number };
  /** The cell tiled this turn, where a ranger may go. */
  last?: string;
  funds: number[];
  points: number[];
  rangers: Ranger[];
  /** Rangers each seat still has in hand. */
  rangersLeft: number[];
  /** Ids of regions already scored. */
  scored: string[];
  /** Regions the latest placement completed, with what each seat scored for them. */
  completed: { terrain: string; size: number; points: number[] }[];
  over: boolean;
}

export type WildmereMove =
  | { type: "take"; slot: number }
  | { type: "turn"; dir: 1 | -1 }
  | { type: "place"; cell: string }
  | { type: "ranger"; side: number }
  | { type: "done" };

const sameMove = (a: WildmereMove, b: WildmereMove) => JSON.stringify(a) === JSON.stringify(b);

export const heldEdges = (s: WildmereState): string[] => (s.held ? rotate(WILDMERE_TILES[s.held.tile], s.held.rotation) : []);

/** Points for a complete region: one per tile, half to the runner-up with three or more players. */
export const regionAwards = (size: number, numPlayers: number): number[] => (numPlayers >= 3 ? [size, Math.floor(size / 2)] : [size]);

/** Each seat's presence in a region: tiles they placed in it, plus RANGER_WEIGHT per ranger on it. */
export function regionPresence(s: WildmereState, region: Region, index: Record<string, Region>): number[] {
  const counts = new Array<number>(s.numPlayers).fill(0);
  for (const cell of region.cells) {
    const owner = s.placed[cell].owner;
    if (owner !== undefined) counts[owner]++;
  }
  for (const ranger of s.rangers) {
    if (rangerRegion(s, ranger, index) === region) counts[ranger.owner] += RANGER_WEIGHT;
  }
  return counts;
}

export const rangerRegion = (s: WildmereState, ranger: Ranger, index: Record<string, Region>): Region | undefined => {
  const edges = s.placed[ranger.cell].edges;
  const seg = segments(edges).find((sg) => sg.sides.includes(ranger.side))!;
  return index[`${ranger.cell}:${Math.min(...seg.sides)}`];
};

// Placements never change once made, so regions are worked out once per layout (bots ask often).
const regionCache = new WeakMap<Layout<Tile>, { all: Region[]; index: Record<string, Region> }>();
function regionsOf(s: WildmereState) {
  let found = regionCache.get(s.placed);
  if (!found) {
    const all = regions(boardFor(s.radius), s.placed);
    regionCache.set(s.placed, (found = { all, index: regionIndex(all) }));
  }
  return found;
}

/** The valley's regions; shared between callers, so treat them as read-only. */
export const valleyRegions = (s: WildmereState) => regionsOf(s).all;
/** Part key to region for the valley as it stands. */
export const valleyIndex = (s: WildmereState) => regionsOf(s).index;

/** A seat's score as the table shows it: points so far plus leftover funds. */
export const wildmereScore = (s: WildmereState, seat: PlayerId) => s.points[seat] + Math.floor(s.funds[seat] / FUND_RATE);

/** Scores every complete region that has not scored yet; its rangers go home. */
function scoreCompleted(s: WildmereState): WildmereState {
  const { all, index } = regionsOf(s);
  const done = all.filter((r) => r.open === 0 && !s.scored.includes(r.id));
  if (done.length === 0) return { ...s, completed: [] };
  const points = s.points.slice();
  const completed = done.map((region) => {
    const awards = majorityAwards(regionPresence(s, region, index), regionAwards(region.cells.length, s.numPlayers));
    awards.forEach((p, seat) => (points[seat] += p));
    return { terrain: region.terrain, size: region.cells.length, points: awards };
  });
  const finished = new Set(done);
  const leaving = s.rangers.filter((r) => finished.has(rangerRegion(s, r, index)!));
  const rangersLeft = s.rangersLeft.map((n, seat) => n + leaving.filter((r) => r.owner === seat).length);
  return {
    ...s,
    points,
    rangers: s.rangers.filter((r) => !leaving.includes(r)),
    rangersLeft,
    scored: [...s.scored, ...done.map((r) => r.id)],
    completed,
  };
}

/** Segments of the tile just placed that sit in unfinished regions, one side per region. */
export function rangerSpots(s: WildmereState): number[] {
  if (!s.last) return [];
  const index = valleyIndex(s);
  const seen = new Set<Region>();
  return segments(s.placed[s.last].edges).flatMap((seg) => {
    const region = index[`${s.last}:${Math.min(...seg.sides)}`];
    if (!region || region.open === 0 || seen.has(region)) return [];
    seen.add(region);
    return [Math.min(...seg.sides)];
  });
}

const canStation = (s: WildmereState, seat: PlayerId) => s.rangersLeft[seat] > 0 && s.funds[seat] >= RANGER_COST;

function endTurn(s: WildmereState): WildmereState {
  const over = s.market.length === 0;
  return { ...s, phase: "take", last: undefined, over, toMove: over ? s.toMove : (s.toMove + 1) % s.numPlayers };
}

/** Lays the held tile in `cell` as it is turned now: pays matching edges, scores finished regions. */
export function placeHeld(s: WildmereState, player: PlayerId, cell: string, rotation = s.held!.rotation): WildmereState {
  const edges = rotate(WILDMERE_TILES[s.held!.tile], rotation);
  const { matching } = fit(boardFor(s.radius), s.placed, cell, edges);
  // The first matching edge is free: only a tile that fits on two or more sides earns.
  const funds = s.funds.map((f, seat) => (seat === player ? f + Math.max(0, matching - 1) : f));
  return scoreCompleted({ ...s, funds, placed: { ...s.placed, [cell]: { edges, owner: player } }, held: undefined, last: cell });
}

/**
 * Wildmere: rival trusts rewild a valley one hex tile at a time. Take a tile from the market row
 * (skipping tiles costs funds, which wait on them for whoever takes them), turn it and lay it next to
 * the valley; matching edges pay funds and join terrain into regions. A region scores the moment no
 * edge of it faces an empty space, one point per tile to whoever placed most of it, with rangers
 * counting extra. The game ends when the valley is full.
 */
export const wildmere: GameModule<WildmereState, WildmereMove, WildmereParams> = {
  meta: {
    id: "wildmere",
    name: "Wildmere",
    family: "grid",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 4,
    summary: "Lay hex tiles to rewild a valley: match terrain edges for funds and win the majorities of woodland, meadow, wetland and heath as they close.",
    rules: [
      "Players start with 2 funds; the third seat starts with 3 and the fourth with 4. Take a tile from the market row: the first is free, and each later one costs 1 fund left on every tile you skip; you also collect any funds lying on your tile.",
      "Turn the tile and lay it next to the valley. Every edge after the first that matches the terrain it touches pays 1 fund, and matching edges join terrain into regions.",
      "A region is complete once none of its edges faces an empty space. It scores at once: 1 point per tile to whoever placed the most tiles in it, half (rounded down) to the runner-up with 3+ players; ties share.",
      "After laying a tile you may pay 2 funds to station a ranger on one of its unfinished terrains; it counts as 2 tiles there and comes back when that region scores.",
      "The game ends when the valley is full. Every 3 leftover funds score 1 point; highest score wins, and ties go to the most funds left.",
    ],
    resources: WILDMERE_RESOURCES,
  },
  params: [
    { key: "radius", label: "Valley rings", kind: "int", min: 3, max: 4, default: 3 },
    { key: "marketSize", label: "Tiles on offer", kind: "int", min: 3, max: 5, default: 4 },
    { key: "rangers", label: "Rangers each", kind: "int", min: 0, max: 4, default: 3 },
  ],

  setup: ({ numPlayers, params, rng }) => {
    const board = boardFor(params.radius);
    // Exactly enough tiles to fill the valley, so every region completes by the end.
    const tiles = rng.shuffle(WILDMERE_TILES.map((_, i) => i)).slice(0, board.cells.length - 1);
    return {
      numPlayers,
      radius: params.radius,
      marketSize: params.marketSize,
      placed: { [CENTER]: { edges: START_TILE } },
      supply: tiles.slice(params.marketSize),
      market: tiles.slice(0, params.marketSize).map((tile) => ({ tile, funds: 0 })),
      toMove: 0,
      phase: "take",
      // Later seats start richer: with 2 funds for the first seat and 3 for the rest, the second seat
      // won 37-42% of 3-player games; 2, 2, 3, 4 brings seats within a few points of the fair share.
      funds: Array.from({ length: numPlayers }, (_, seat) => (seat < 2 ? 2 : seat + 1)),
      points: new Array(numPlayers).fill(0),
      rangers: [],
      rangersLeft: new Array(numPlayers).fill(params.rangers),
      scored: [],
      completed: [],
      over: false,
    };
  },

  activePlayers: (s) => (s.over ? [] : [s.toMove]),

  legalMoves(s, player) {
    if (s.over || player !== s.toMove) return [];
    switch (s.phase) {
      case "take":
        return s.market.flatMap((_, slot) => (slot <= s.funds[player] ? [{ type: "take" as const, slot }] : []));
      case "place": {
        const moves: WildmereMove[] = frontier(boardFor(s.radius), s.placed).map((cell) => ({ type: "place", cell }));
        if (s.held!.turns < MAX_TURNS) moves.push({ type: "turn", dir: 1 }, { type: "turn", dir: -1 });
        return moves;
      }
      case "ranger":
        return [...(canStation(s, player) ? rangerSpots(s).map((side) => ({ type: "ranger" as const, side })) : []), { type: "done" }];
    }
  },

  applyMove(s, player, move) {
    if (!wildmere.legalMoves(s, player).some((m) => sameMove(m, move))) throw new Error(`illegal move ${JSON.stringify(move)}`);
    switch (move.type) {
      case "take": {
        const chosen = s.market[move.slot];
        // Skipped tiles each get one of the taker's funds.
        const market = s.market.flatMap((m, i) => (i < move.slot ? [{ ...m, funds: m.funds + 1 }] : i === move.slot ? [] : [m]));
        const [drawn, ...supply] = s.supply;
        return {
          ...s,
          market: drawn === undefined ? market : [...market, { tile: drawn, funds: 0 }],
          supply,
          funds: s.funds.map((f, seat) => (seat === player ? f - move.slot + chosen.funds : f)),
          held: { tile: chosen.tile, rotation: 0, turns: 0 },
          phase: "place",
          completed: [],
        };
      }
      case "turn":
        return { ...s, held: { ...s.held!, rotation: (s.held!.rotation + move.dir + 6) % 6, turns: s.held!.turns + 1 } };
      case "place": {
        const next = placeHeld(s, player, move.cell);
        return canStation(next, player) && rangerSpots(next).length > 0 ? { ...next, phase: "ranger" } : endTurn(next);
      }
      case "ranger":
        return endTurn({
          ...s,
          funds: s.funds.map((f, seat) => (seat === player ? f - RANGER_COST : f)),
          rangers: [...s.rangers, { owner: player, cell: s.last!, side: move.side }],
          rangersLeft: s.rangersLeft.map((n, seat) => (seat === player ? n - 1 : n)),
        });
      case "done":
        return endTurn(s);
    }
  },

  isTerminal: (s) => s.over,

  outcome(s) {
    const scores = Array.from({ length: s.numPlayers }, (_, seat) => wildmereScore(s, seat));
    // Ties go to whoever has the most funds left.
    return { winners: s.over ? scoring.scoreWinners(scores, s.funds) : [], scores };
  },

  // Which tiles are still to come is public (every tile is known), but not their order.
  view: (s) => ({ ...s, supply: s.supply.slice().sort((a, b) => a - b) }),

  geometry(s): Geometry {
    const board = boardFor(s.radius);
    const targets = s.phase === "place" ? new Set(frontier(board, s.placed)) : new Set<string>();
    const cells: GeometryCell[] = board.cells.map((cell) => {
      const tile = s.placed[cell.id];
      return tile
        ? { id: cell.id, polygon: cell.polygon, kind: "tile", segments: tile.edges, owner: tile.owner }
        : { id: cell.id, polygon: cell.polygon, kind: targets.has(cell.id) ? "frontier" : "slot" };
    });
    const pieces: GeometryPiece[] = s.rangers.map((ranger, i) => {
      const seg = segments(s.placed[ranger.cell].edges).find((sg) => sg.sides.includes(ranger.side))!;
      const [x, y] = segmentPoint(board, ranger.cell, seg.sides);
      return { id: `ranger-${ranger.owner}-${i}`, x, y, r: 0.13, owner: ranger.owner, shape: "pawn", kind: "ranger", cellId: ranger.cell };
    });

    // The market runs down a column right of the valley, the tile being placed beside it.
    const size = 0.42;
    const top = 0.75;
    const step = Math.min(1.2, Math.max(0.92, (board.height - top) / s.marketSize));
    const mx = board.width + 0.6;
    cells.push(text("market-title", mx - 0.42, 0.3, `Market · ${s.supply.length} more`));
    s.market.forEach((offer, slot) => {
      const cy = top + size + slot * step;
      cells.push({ id: `market-${slot}`, polygon: hexagon(mx, cy, size), kind: "tile", segments: WILDMERE_TILES[offer.tile] });
      const price = slot === 0 ? "Free" : `Pay ${slot}`;
      cells.push(text(`price-${slot}`, mx + 0.5, cy, offer.funds > 0 ? `${price} · +${offer.funds}` : price));
    });
    const hx = mx + 2.75;
    const hy = board.height / 2;
    const heading = s.held ? "To place" : "Next: take";
    cells.push(text("held-title", hx - (LABEL * heading.length) / 2.6, hy - 1.05, heading));
    if (s.held) cells.push({ id: "held", polygon: hexagon(hx, hy, 0.62), kind: "tile", segments: heldEdges(s) });
    else cells.push({ id: "held", polygon: hexagon(hx, hy, 0.62), kind: "slot" });
    return { width: hx + 0.95, height: board.height, cells, pieces };
  },

  panels(s) {
    // Panel notes share a line with the title, so they stay short.
    const recent = s.completed
      .map((c) => `${terrainName(c.terrain)} ${c.size} (${c.points.flatMap((p, seat) => (p > 0 ? [`P${seat + 1} +${p}`] : [])).join(", ") || "no one"})`)
      .join(", ");
    const panels: Panel[] = [
      {
        id: "valley",
        title: "Valley",
        zone: "shared",
        counters: [
          { id: "valley-left", label: "Tiles left", value: s.supply.length + s.market.length },
          { id: "valley-closed", label: "Regions closed", value: s.scored.length },
        ],
        note: recent ? `Closed: ${recent}` : "Closed regions score at once",
      },
    ];
    for (let seat = 0; seat < s.numPlayers; seat++) {
      panels.push({
        id: `seat${seat}`,
        title: `Player ${seat + 1}`,
        zone: "players",
        owner: seat,
        counters: [
          { id: `seat${seat}-funds`, label: "Funds", value: s.funds[seat], resource: "funds" },
          { id: `seat${seat}-rangers`, label: "Rangers", value: s.rangersLeft[seat] },
          { id: `seat${seat}-score`, label: "Score", value: wildmereScore(s, seat) },
        ],
      });
    }
    return panels;
  },

  moveTarget(_s, move) {
    if (move.type === "take") return `market-${move.slot}`;
    if (move.type === "place") return move.cell;
    return undefined;
  },

  describeMove(s, move) {
    switch (move.type) {
      case "take": {
        const funds = s.market[move.slot].funds;
        const cost = move.slot === 0 ? "free" : `pay ${move.slot}`;
        return `take market tile ${move.slot + 1} (${cost}${funds > 0 ? `, collect ${funds}` : ""})`;
      }
      case "turn":
        return move.dir === 1 ? "turn the tile clockwise" : "turn the tile counterclockwise";
      case "place": {
        const { matching } = fit(boardFor(s.radius), s.placed, move.cell, heldEdges(s));
        const after = placeHeld(s, s.toMove, move.cell);
        const closes = after.completed.map((c) => `${terrainName(c.terrain).toLowerCase()} of ${c.size}`);
        return `lay the tile at ${move.cell}: ${matching} matching edge${matching === 1 ? "" : "s"}${closes.length ? `, completes ${closes.join(" and ")}` : ""}`;
      }
      case "ranger": {
        const terrain = s.placed[s.last!].edges[move.side];
        return `station a ranger on the ${terrainName(terrain).toLowerCase()} (${RANGER_COST} funds)`;
      }
      case "done":
        return "no ranger: end the turn";
    }
  },
};

/** Text height on the board, in board units. */
const LABEL = 0.24;

/**
 * A label starting at x, centered on y. The renderers size text by its box's width, so the box is
 * as wide as the text at LABEL height, keeping every label the same size.
 */
function text(id: string, x: number, y: number, label: string): GeometryCell {
  const w = (LABEL * Math.max(1, label.length)) / 1.3;
  return { id, polygon: rect(x, y - 0.25, w, 0.5), kind: "label", label };
}

const rect = (x: number, y: number, w: number, h: number): [number, number][] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** A pointy-top hexagon, corners in the same order as the valley's cells so segments line up. */
const hexagon = (cx: number, cy: number, r: number): [number, number][] =>
  Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as [number, number];
  });
