/**
 * Hex maps you build on: settlements on the corners (vertices) where tiles meet, roads on the
 * edges between corners. Covers placement rules (the distance rule, connected roads) and geometry
 * cells the renderer understands: kind "vertex" for building spots, kind "edge" for roads.
 *
 * Tiles are pointy-top hexagons in axial coordinates (q, r). A map is pure geometry and never
 * changes during a game, so build it once (module scope or memoized) and keep only ids in state.
 */

export interface HexTile {
  id: string;
  q: number;
  r: number;
  center: [number, number];
  /** Corner vertex ids, clockwise from the upper right. */
  corners: string[];
}

export interface HexVertex {
  id: string;
  at: [number, number];
  /** Tiles that share this corner (1 to 3). */
  tiles: string[];
  /** Corners one edge away. */
  neighbors: string[];
  edges: string[];
}

export interface HexEdge {
  id: string;
  ends: [string, string];
  tiles: string[];
}

export interface HexMap {
  tiles: HexTile[];
  vertices: HexVertex[];
  edges: HexEdge[];
  width: number;
  height: number;
}

/** Vertex id to its owner and level (1 = settlement, 2 = upgraded). */
export type Buildings = Record<string, { owner: number; level: number }>;
/** Edge id to its owner. */
export type Roads = Record<string, number>;

const SQRT3 = Math.sqrt(3);

/** Axial coordinates of a hexagon-shaped map: 7 tiles for radius 1, 19 for radius 2, 37 for radius 3. */
export function radiusCoords(radius: number): [number, number][] {
  const out: [number, number][] = [];
  for (let r = -radius; r <= radius; r++) {
    for (let q = -radius; q <= radius; q++) if (Math.abs(q + r) <= radius) out.push([q, r]);
  }
  return out;
}

/** Builds the vertex and edge graph for the given tiles. Ids are stable: sorted top to bottom, left to right. */
export function buildHexMap(coords: readonly [number, number][], size = 1, pad = 0.5): HexMap {
  const raw = coords.map(([q, r]) => {
    const cx = size * SQRT3 * (q + r / 2);
    const cy = size * 1.5 * r;
    const corners = Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      return [cx + size * Math.cos(angle), cy + size * Math.sin(angle)] as [number, number];
    });
    return { q, r, center: [cx, cy] as [number, number], corners };
  });
  const xs = raw.flatMap((t) => t.corners.map(([x]) => x));
  const ys = raw.flatMap((t) => t.corners.map(([, y]) => y));
  const [minX, minY] = [Math.min(...xs) - pad, Math.min(...ys) - pad];
  const shift = ([x, y]: [number, number]): [number, number] => [x - minX, y - minY];
  const key = ([x, y]: [number, number]) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;

  // Deduplicate corners shared by neighboring tiles.
  const points = new Map<string, [number, number]>();
  for (const t of raw) for (const c of t.corners) points.set(key(c), shift(c));
  const byPosition = (a: [number, number], b: [number, number]) => a[1] - b[1] || a[0] - b[0];
  const vertexKeys = [...points.keys()].sort((a, b) => byPosition(points.get(a)!, points.get(b)!));
  const vertexId = new Map(vertexKeys.map((k, i) => [k, `v${i}`]));

  const tiles: HexTile[] = raw
    .map((t) => ({ ...t, center: shift(t.center) }))
    .sort((a, b) => byPosition(a.center, b.center))
    .map((t, i) => ({ id: `t${i}`, q: t.q, r: t.r, center: t.center, corners: t.corners.map((c) => vertexId.get(key(c))!) }));

  const vertexMap = new Map<string, HexVertex>(
    vertexKeys.map((k) => [vertexId.get(k)!, { id: vertexId.get(k)!, at: points.get(k)!, tiles: [], neighbors: [], edges: [] }]),
  );
  const edgeEnds = new Map<string, { ends: [string, string]; tiles: string[] }>();
  for (const tile of tiles) {
    tile.corners.forEach((v, i) => {
      vertexMap.get(v)!.tiles.push(tile.id);
      const w = tile.corners[(i + 1) % 6];
      const ends = [v, w].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))) as [string, string];
      const k = ends.join("-");
      const entry = edgeEnds.get(k) ?? { ends, tiles: [] };
      entry.tiles.push(tile.id);
      edgeEnds.set(k, entry);
    });
  }
  const mid = (e: { ends: [string, string] }): [number, number] => {
    const [a, b] = e.ends.map((v) => vertexMap.get(v)!.at);
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  const edges: HexEdge[] = [...edgeEnds.values()].sort((a, b) => byPosition(mid(a), mid(b))).map((e, i) => ({ id: `e${i}`, ...e }));
  for (const edge of edges) {
    const [a, b] = edge.ends.map((v) => vertexMap.get(v)!);
    a.edges.push(edge.id);
    b.edges.push(edge.id);
    a.neighbors.push(b.id);
    b.neighbors.push(a.id);
  }

  const vertices = [...vertexMap.values()];
  return {
    tiles,
    vertices,
    edges,
    width: Math.max(...xs) - minX + pad,
    height: Math.max(...ys) - minY + pad,
  };
}

interface Lookup {
  tile: Map<string, HexTile>;
  vertex: Map<string, HexVertex>;
  edge: Map<string, HexEdge>;
}

const lookups = new WeakMap<HexMap, Lookup>();

/** Id lookups for a map, built once per map. */
export function lookup(map: HexMap): Lookup {
  let found = lookups.get(map);
  if (!found) {
    found = {
      tile: new Map(map.tiles.map((t) => [t.id, t])),
      vertex: new Map(map.vertices.map((v) => [v.id, v])),
      edge: new Map(map.edges.map((e) => [e.id, e])),
    };
    lookups.set(map, found);
  }
  return found;
}

/**
 * Can `owner` build a settlement on `vertex`? The corner must be empty with no building on a
 * neighboring corner (the distance rule). With `requireRoad`, one of the owner's roads must touch it.
 */
export function canSettle(map: HexMap, buildings: Buildings, roads: Roads, vertex: string, owner: number, requireRoad: boolean): boolean {
  const v = lookup(map).vertex.get(vertex);
  if (!v || buildings[vertex] || v.neighbors.some((n) => buildings[n])) return false;
  return !requireRoad || v.edges.some((e) => roads[e] === owner);
}

/** Every corner where `owner` may settle. */
export function settleSpots(map: HexMap, buildings: Buildings, roads: Roads, owner: number, requireRoad: boolean): string[] {
  return map.vertices.filter((v) => canSettle(map, buildings, roads, v.id, owner, requireRoad)).map((v) => v.id);
}

/**
 * Can `owner` build a road on `edge`? It must be empty and connect to the owner's network: a
 * building of theirs at one end, or another of their roads at an end not blocked by a rival's building.
 */
export function canRoad(map: HexMap, buildings: Buildings, roads: Roads, edge: string, owner: number): boolean {
  const { edge: edges, vertex: vertices } = lookup(map);
  const e = edges.get(edge);
  if (!e || roads[edge] !== undefined) return false;
  return e.ends.some((end) => {
    const building = buildings[end];
    if (building) return building.owner === owner;
    return vertices.get(end)!.edges.some((other) => other !== edge && roads[other] === owner);
  });
}

/** Every edge where `owner` may build a road. */
export function roadSpots(map: HexMap, buildings: Buildings, roads: Roads, owner: number): string[] {
  return map.edges.filter((e) => canRoad(map, buildings, roads, e.id, owner)).map((e) => e.id);
}

/** Small hexagon around a corner, for clickable building spots. */
export function vertexPolygon(map: HexMap, vertex: string, radius = 0.16): [number, number][] {
  const [x, y] = lookup(map).vertex.get(vertex)!.at;
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i;
    return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
  });
}

/** Thin strip along an edge, trimmed at both ends so it stays clear of the corner spots. */
export function edgePolygon(map: HexMap, edge: string, width = 0.13, trim = 0.24): [number, number][] {
  const { vertex, edge: edges } = lookup(map);
  const [a, b] = edges.get(edge)!.ends.map((v) => vertex.get(v)!.at);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const [dx, dy] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const [nx, ny] = [(-dy * width) / 2, (dx * width) / 2];
  const from: [number, number] = [a[0] + dx * length * trim, a[1] + dy * length * trim];
  const to: [number, number] = [b[0] - dx * length * trim, b[1] - dy * length * trim];
  return [
    [from[0] + nx, from[1] + ny],
    [to[0] + nx, to[1] + ny],
    [to[0] - nx, to[1] - ny],
    [from[0] - nx, from[1] - ny],
  ];
}

/** The tile's hexagon outline, slightly inset. */
export function tilePolygon(map: HexMap, tile: string, inset = 0.97): [number, number][] {
  const { tile: tiles, vertex } = lookup(map);
  const t = tiles.get(tile)!;
  return t.corners.map((v) => {
    const [x, y] = vertex.get(v)!.at;
    return [t.center[0] + (x - t.center[0]) * inset, t.center[1] + (y - t.center[1]) * inset];
  });
}
