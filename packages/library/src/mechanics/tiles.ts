/**
 * Tile placement: tiles with a terrain on each edge are laid one at a time on a shared square or hex
 * board, next to tiles already there. Covers rotation, edge matching (strict, or counted for
 * scoring), the regions that matching edges join across tiles, and open edges, so a game can score
 * a region once it is complete.
 *
 * A board is pure geometry: build it once (module scope or memoized) and keep only the placed tiles
 * in state, as a record from cell id to the tile's edges after rotation. Edge i of a tile runs from
 * polygon[i] to polygon[i + 1] of its cell; the renderer paints a geometry cell's `segments` the
 * same way, so placed tiles can be drawn by passing their edges straight through.
 */

export type TileShape = "square" | "hex";

export interface TileCell {
  id: string;
  /** Column and row on a square board; axial (q, r) on a hex board. */
  x: number;
  y: number;
  center: [number, number];
  polygon: [number, number][];
  /** The cell across each side, or undefined past the board's rim. */
  neighbors: (string | undefined)[];
}

export interface TileBoard {
  shape: TileShape;
  /** 4 for squares, 6 for hexes. */
  sides: number;
  cells: TileCell[];
  byId: Record<string, TileCell>;
  width: number;
  height: number;
}

/** A placed tile: its terrain per side after rotation. Games may store more (owner, tile id). */
export interface Placed {
  edges: string[];
}

export type Layout<T extends Placed = Placed> = Record<string, T>;

/** Sides 0-3 face north, east, south and west. */
const SQUARE_SIDES = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

/** Pointy-top hexes in axial coordinates: side 0 faces east, then clockwise. */
const HEX_SIDES = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
] as const;

const SQRT3 = Math.sqrt(3);

function finish(shape: TileShape, cells: Omit<TileCell, "neighbors">[], width: number, height: number): TileBoard {
  const dirs = shape === "square" ? SQUARE_SIDES : HEX_SIDES;
  const ids = new Set(cells.map((c) => c.id));
  const full = cells.map((cell) => ({
    ...cell,
    neighbors: dirs.map(([dx, dy]) => {
      const id = `${cell.x + dx},${cell.y + dy}`;
      return ids.has(id) ? id : undefined;
    }),
  }));
  return { shape, sides: dirs.length, cells: full, byId: Object.fromEntries(full.map((c) => [c.id, c])), width, height };
}

/** A width x height board of squares with sides of length `size`. Cell ids are "x,y". */
export function squareBoard(width: number, height: number, size = 1): TileBoard {
  const cells: Omit<TileCell, "neighbors">[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [x0, y0] = [x * size, y * size];
      cells.push({
        id: `${x},${y}`,
        x,
        y,
        center: [x0 + size / 2, y0 + size / 2],
        polygon: [
          [x0, y0],
          [x0 + size, y0],
          [x0 + size, y0 + size],
          [x0, y0 + size],
        ],
      });
    }
  }
  return finish("square", cells, width * size, height * size);
}

/**
 * A hexagon-shaped board of pointy-top hexes, `radius` rings around the center cell "0,0", with
 * hexes of circumradius `size`. Cell ids are axial "q,r".
 */
export function hexBoard(radius: number, size = 0.5): TileBoard {
  const cells: Omit<TileCell, "neighbors">[] = [];
  for (let r = -radius; r <= radius; r++) {
    for (let q = -radius; q <= radius; q++) {
      if (Math.abs(q + r) > radius) continue;
      const cx = size * SQRT3 * (q + r / 2 + radius + 0.5);
      const cy = size * (1.5 * (r + radius) + 1);
      const polygon = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        return [cx + size * Math.cos(angle), cy + size * Math.sin(angle)] as [number, number];
      });
      cells.push({ id: `${q},${r}`, x: q, y: r, center: [cx, cy], polygon });
    }
  }
  return finish("hex", cells, size * SQRT3 * (2 * radius + 1), size * (3 * radius + 2));
}

export const opposite = (board: TileBoard, side: number) => (side + board.sides / 2) % board.sides;

/** Edges turned clockwise by `steps` sides (negative turns counterclockwise). */
export function rotate<T>(edges: readonly T[], steps: number): T[] {
  const n = edges.length;
  const k = ((steps % n) + n) % n;
  return edges.map((_, i) => edges[(i - k + n) % n]);
}

/** Rotations (0 to sides - 1) that give different edge orders; symmetric tiles have fewer. */
export function distinctRotations<T>(edges: readonly T[]): number[] {
  const seen = new Set<string>();
  return edges.flatMap((_, steps) => {
    const key = JSON.stringify(rotate(edges, steps));
    if (seen.has(key)) return [];
    seen.add(key);
    return [steps];
  });
}

/** Empty cells next to at least one placed tile: where the next tile may go. */
export function frontier(board: TileBoard, placed: Layout<Placed>): string[] {
  return board.cells.filter((cell) => !placed[cell.id] && cell.neighbors.some((n) => n !== undefined && placed[n])).map((c) => c.id);
}

export interface Fit {
  /** Sides that touch a placed tile. */
  touching: number;
  matching: number;
  mismatched: number;
}

/** How `edges` would sit in `cell`: how many sides touch placed tiles, and how many of those match. */
export function fit(board: TileBoard, placed: Layout<Placed>, cell: string, edges: readonly string[]): Fit {
  const result: Fit = { touching: 0, matching: 0, mismatched: 0 };
  board.byId[cell].neighbors.forEach((n, side) => {
    const other = n === undefined ? undefined : placed[n];
    if (!other) return;
    result.touching++;
    if (other.edges[opposite(board, side)] === edges[side]) result.matching++;
    else result.mismatched++;
  });
  return result;
}

/**
 * Whether `edges` may go in `cell`: an empty cell next to a placed tile, and with `strict` (the
 * default) every touching side must match.
 */
export function fits(board: TileBoard, placed: Layout<Placed>, cell: string, edges: readonly string[], strict = true): boolean {
  if (placed[cell] || !board.byId[cell]) return false;
  const f = fit(board, placed, cell, edges);
  return f.touching > 0 && (!strict || f.mismatched === 0);
}

/** Every cell and distinct rotation where a tile may go, with how many sides would match. */
export function placements(
  board: TileBoard,
  placed: Layout<Placed>,
  edges: readonly string[],
  strict = true,
): { cell: string; rotation: number; matching: number }[] {
  const rotations = distinctRotations(edges);
  return frontier(board, placed).flatMap((cell) =>
    rotations.flatMap((rotation) => {
      const turned = rotate(edges, rotation);
      const f = fit(board, placed, cell, turned);
      return strict && f.mismatched > 0 ? [] : [{ cell, rotation, matching: f.matching }];
    }),
  );
}

export interface Segment {
  terrain: string;
  /** Neighboring sides with this terrain, in clockwise order. */
  sides: number[];
}

/**
 * A tile's segments: runs of neighboring sides with the same terrain, wrapping around. Each run is
 * one piece of land; a run of another terrain between two runs splits them.
 */
export function segments(edges: readonly string[]): Segment[] {
  const n = edges.length;
  const start = edges.findIndex((terrain, i) => terrain !== edges[(i - 1 + n) % n]);
  if (start < 0) return [{ terrain: edges[0], sides: edges.map((_, i) => i) }];
  const result: Segment[] = [];
  for (let k = 0; k < n; k++) {
    const side = (start + k) % n;
    const last = result[result.length - 1];
    if (last && last.terrain === edges[side]) last.sides.push(side);
    else result.push({ terrain: edges[side], sides: [side] });
  }
  return result;
}

/** The segment of `edges` that holds `side`. */
export const segmentOf = (edges: readonly string[], side: number): Segment => segments(edges).find((s) => s.sides.includes(side))!;

/** Key of the segment holding `side` of the tile in `cell`: "cell:lowest side of the segment". */
export const partKey = (cell: string, edges: readonly string[], side: number) => `${cell}:${Math.min(...segmentOf(edges, side).sides)}`;

export interface Region {
  /** The smallest part key in it; stable once the region is complete, since nothing can join it. */
  id: string;
  terrain: string;
  /** Segment keys ("cell:side"). */
  parts: string[];
  /** Cells with at least one segment in the region, each once. */
  cells: string[];
  /** Sides facing an empty cell: the region is complete when none are left. */
  open: number;
  /** Sides facing past the board's rim. */
  rim: number;
}

/**
 * Regions of the placed tiles: segments joined across matching edges. A side facing a mismatched
 * tile or the rim closes the region there; a side facing an empty cell keeps it open.
 */
export function regions(board: TileBoard, placed: Layout<Placed>): Region[] {
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // Path compression keeps repeated lookups cheap.
    for (let k = key; k !== root; ) {
      const next = parent.get(k)!;
      parent.set(k, root);
      k = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  };
  // Side -> part key for each placed cell.
  const keys: Record<string, string[]> = {};
  for (const [cell, tile] of Object.entries(placed)) {
    keys[cell] = new Array(board.sides);
    for (const seg of segments(tile.edges)) {
      const key = `${cell}:${Math.min(...seg.sides)}`;
      parent.set(key, key);
      for (const side of seg.sides) keys[cell][side] = key;
    }
  }
  const open = new Map<string, number>();
  const rim = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const [cell, tile] of Object.entries(placed)) {
    board.byId[cell].neighbors.forEach((n, side) => {
      const key = keys[cell][side];
      if (n === undefined) return void bump(rim, key);
      const other = placed[n];
      if (!other) return void bump(open, key);
      const back = opposite(board, side);
      if (other.edges[back] === tile.edges[side]) union(key, keys[n][back]);
    });
  }
  const groups = new Map<string, Region>();
  for (const key of [...parent.keys()].sort()) {
    const root = find(key);
    const cell = key.slice(0, key.lastIndexOf(":"));
    const side = Number(key.slice(key.lastIndexOf(":") + 1));
    let region = groups.get(root);
    if (!region) groups.set(root, (region = { id: key, terrain: placed[cell].edges[side], parts: [], cells: [], open: 0, rim: 0 }));
    region.parts.push(key);
    if (!region.cells.includes(cell)) region.cells.push(cell);
    region.open += open.get(key) ?? 0;
    region.rim += rim.get(key) ?? 0;
  }
  return [...groups.values()];
}

/** Part key to region, for looking up where a segment (or a piece standing on one) belongs. */
export function regionIndex(list: readonly Region[]): Record<string, Region> {
  return Object.fromEntries(list.flatMap((region) => region.parts.map((part) => [part, region])));
}

/** Where to stand a piece on a segment: the middle of its wedges, pulled toward the cell's center. */
export function segmentPoint(board: TileBoard, cell: string, sides: readonly number[]): [number, number] {
  const { center, polygon } = board.byId[cell];
  if (sides.length === board.sides) return center;
  const n = polygon.length;
  const mids = sides.map((side) => {
    const [a, b] = [polygon[side], polygon[(side + 1) % n]];
    return [(center[0] + a[0] + b[0]) / 3, (center[1] + a[1] + b[1]) / 3];
  });
  return [mids.reduce((sum, [x]) => sum + x, 0) / mids.length, mids.reduce((sum, [, y]) => sum + y, 0) / mids.length];
}
