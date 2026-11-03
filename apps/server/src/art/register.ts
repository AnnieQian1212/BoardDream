import { insidePolygon, type Geometry, type GeometryCell } from "@boarddream/engine";
import type { Picture } from "./content";

/**
 * Lines a painted board up with its geometry before anything reads it. The image model keeps the
 * guide's tiles but not always where they were: Farlight Reefs came back with every tile about a
 * fifth of a tile low, so each tile, cut from the painting where the guide put it, showed a band of
 * the painter's dark gap along its top. The painting is searched for the stretch and shift that
 * put its painted tiles on the guide's tiles and its bare paper and gaps off them, then resampled
 * so its tiles sit where the geometry says. No model is called.
 */

export interface Registration {
  /** How much larger the painted tiles came out than the guide's, across and down. */
  scaleX: number;
  scaleY: number;
  /** How far the painted tiles came out from the guide's, in board units. */
  shiftX: number;
  shiftY: number;
  /** How well the painted tiles lined up with the guide's before and after, from -1 to 1. */
  before: number;
  after: number;
}

type Point = [number, number];

const centroid = (polygon: Point[]): Point => [
  polygon.reduce((s, [x]) => s + x, 0) / polygon.length,
  polygon.reduce((s, [, y]) => s + y, 0) / polygon.length,
];

/**
 * Where a painting should show a painted tile and where not, in board units: points spread over
 * each tile's inside, and points off every tile (the paper round the board, the gaps two tiles
 * share). A cell that holds other tiles (a frame round the whole board) is left out.
 */
export function landmarks(cells: GeometryCell[]): { tiles: Point[]; off: Point[] } {
  const holds = (cell: GeometryCell) => cells.some((other) => other !== cell && insidePolygon(...centroid(other.polygon), cell.polygon));
  const tiles = cells.filter((cell) => !holds(cell));
  const on: Point[] = [];
  const off: Point[] = [];
  if (tiles.length === 0) return { tiles: on, off };
  const all = tiles.flatMap((c) => c.polygon);
  const [x0, x1] = [Math.min(...all.map(([x]) => x)), Math.max(...all.map(([x]) => x))];
  const [y0, y1] = [Math.min(...all.map(([, y]) => y)), Math.max(...all.map(([, y]) => y))];
  const step = Math.max(x1 - x0, y1 - y0) / 90;
  const inside = (p: Point, share: number) =>
    tiles.some((c) => {
      const [cx, cy] = centroid(c.polygon);
      return insidePolygon(p[0], p[1], c.polygon.map(([x, y]): Point => [cx + (x - cx) * share, cy + (y - cy) * share]));
    });
  // A grid over the board and a margin round it: inside a tile (the guide draws it at 0.93 of its
  // cell), or off every tile, close to their edges so a small shift shows.
  for (let y = y0 - 6 * step; y <= y1 + 6 * step; y += step) {
    for (let x = x0 - 6 * step; x <= x1 + 6 * step; x += step) {
      if (inside([x, y], 0.88)) on.push([x, y]);
      else if (!inside([x, y], 0.98)) off.push([x, y]);
    }
  }
  // The middle of the gap along every side two tiles share.
  for (const cell of tiles) {
    const polygon = cell.polygon;
    const [cx, cy] = centroid(polygon);
    for (let i = 0; i < polygon.length; i++) {
      const [ax, ay] = polygon[i];
      const [bx, by] = polygon[(i + 1) % polygon.length];
      const len = Math.hypot(bx - ax, by - ay);
      if (len === 0) continue;
      const [nx, ny] = [(by - ay) / len, -(bx - ax) / len];
      const out = nx * ((ax + bx) / 2 - cx) + ny * ((ay + by) / 2 - cy) > 0 ? 1 : -1;
      for (let t = 0.2; t <= 0.81; t += 0.1) {
        const [px, py] = [ax + (bx - ax) * t, ay + (by - ay) * t];
        const across: Point = [px + out * nx * step, py + out * ny * step];
        if (tiles.some((other) => other !== cell && insidePolygon(across[0], across[1], other.polygon))) off.push([px, py]);
      }
    }
  }
  // Every so many, so a search step stays quick on a large board.
  const thin = (points: Point[], most: number) => (points.length <= most ? points : points.filter((_, i) => i % Math.ceil(points.length / most) === 0));
  return { tiles: thin(on, 1500), off: thin(off, 1500) };
}

/** The paper round a painted board: its commonest light, pale color. */
function paperOf(picture: Picture): [number, number, number] | undefined {
  const bins = new Map<number, number>();
  for (let i = 0; i < picture.width * picture.height; i += 7) {
    const [r, g, b] = [picture.rgba[i * 4], picture.rgba[i * 4 + 1], picture.rgba[i * 4 + 2]];
    if (0.299 * r + 0.587 * g + 0.114 * b < 190 || Math.max(r, g, b) - Math.min(r, g, b) > 45) continue;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  const top = [...bins].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top === undefined ? undefined : [((top >> 10) << 3) + 4, (((top >> 5) & 31) << 3) + 4, ((top & 31) << 3) + 4];
}

/**
 * The painting shrunk to about `width` pixels across, as how much each pixel looks like a painted
 * tile: not the paper round the board (its commonest light, pale color) and not the inked gaps.
 */
function tileness(picture: Picture, width: number): { width: number; height: number; tile: Float32Array } {
  const factor = Math.max(1, Math.floor(picture.width / width));
  const [w, h] = [Math.floor(picture.width / factor), Math.floor(picture.height / factor)];
  const paper = paperOf(picture);
  const tile = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let j = 0; j < factor; j++) {
        for (let i = 0; i < factor; i++) {
          const at = ((y * factor + j) * picture.width + x * factor + i) * 4;
          const [r, g, b] = [picture.rgba[at], picture.rgba[at + 1], picture.rgba[at + 2]];
          const dark = Math.min(1, Math.max(0, (110 - (0.299 * r + 0.587 * g + 0.114 * b)) / 70));
          const pale = paper ? Math.min(1, Math.max(0, 1 - Math.hypot(r - paper[0], g - paper[1], b - paper[2]) / 40)) : 0;
          sum += Math.max(0, 1 - dark - pale);
        }
      }
      tile[y * w + x] = sum / (factor * factor);
    }
  }
  return { width: w, height: h, tile };
}

/** Where board point `p` lands on a painting `px` pixels per unit across, stretched by (sx, sy) about its middle and shifted by (tx, ty) pixels. */
const place = (p: Point, px: number, size: { width: number; height: number }, sx: number, sy: number, tx: number, ty: number): Point => [
  size.width / 2 + sx * (p[0] * px - size.width / 2) + tx,
  size.height / 2 + sy * (p[1] * px - size.height / 2) + ty,
];

/**
 * The stretch and shift that best put the painting's inked gaps on the guide's: searched coarse,
 * then fine around the best. Returns the identity when the painting already lines up.
 */
export function findRegistration(picture: Picture, geometry: Geometry, tiles: GeometryCell[]): Registration {
  const marks = landmarks(tiles);
  const identity = { scaleX: 1, scaleY: 1, shiftX: 0, shiftY: 0, before: 0, after: 0 };
  if (marks.tiles.length < 10 || marks.off.length < 10) return identity;
  const map = tileness(picture, 400);
  const px = map.width / geometry.width;
  const at = ([x, y]: Point) => {
    const [i, j] = [Math.round(x), Math.round(y)];
    return i < 0 || j < 0 || i >= map.width || j >= map.height ? 0 : map.tile[j * map.width + i];
  };
  // Painted where the guide has tiles, bare where it has none.
  const score = (sx: number, sy: number, tx: number, ty: number) => {
    let on = 0;
    for (const p of marks.tiles) on += at(place(p, px, map, sx, sy, tx, ty));
    let off = 0;
    for (const p of marks.off) off += at(place(p, px, map, sx, sy, tx, ty));
    return on / marks.tiles.length - off / marks.off.length;
  };
  const reach = Math.round(map.width * 0.06);
  let best = { sx: 1, sy: 1, tx: 0, ty: 0, s: score(1, 1, 0, 0) };
  const before = best.s;
  const search = (scales: number[], dxs: number[], dys: number[], around: typeof best) => {
    let found = around;
    for (const sx of scales.map((d) => around.sx + d)) {
      for (const sy of scales.map((d) => around.sy + d)) {
        for (const tx of dxs.map((d) => around.tx + d)) {
          for (const ty of dys.map((d) => around.ty + d)) {
            const s = score(sx, sy, tx, ty);
            if (s > found.s + 1e-9) found = { sx, sy, tx, ty, s };
          }
        }
      }
    }
    return found;
  };
  const range = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);
  best = search(range(-0.04, 0.04, 0.02), range(-reach, reach, 2), range(-reach, reach, 2), best);
  best = search(range(-0.02, 0.02, 0.005), range(-3, 3, 0.5), range(-3, 3, 0.5), best);
  // Shifts in board units: a board point lands (tx, ty) pixels away, beyond the stretch.
  return { scaleX: best.sx, scaleY: best.sy, shiftX: best.tx / px, shiftY: best.ty / px, before, after: best.s };
}

/** The painting resampled so its tiles sit where the geometry puts them (bilinear). */
export function applyRegistration(picture: Picture, geometry: Geometry, r: Registration): Picture {
  const { width, height } = picture;
  const px = width / geometry.width;
  const rgba = new Uint8Array(width * height * 4);
  // Past the painting's edge lies more paper, not its edge pixels drawn out into streaks.
  const paper = [...(paperOf(picture) ?? [236, 224, 197]), 255];
  const read = (x: number, y: number, c: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? paper[c] : picture.rgba[(y * width + x) * 4 + c];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // This pixel's board point, and where the painter put it.
      const [sx, sy] = place([(x + 0.5) / px, (y + 0.5) / px], px, picture, r.scaleX, r.scaleY, r.shiftX * px, r.shiftY * px);
      const [fx, fy] = [sx - 0.5, sy - 0.5];
      const [x0, y0] = [Math.floor(fx), Math.floor(fy)];
      const [ax, ay] = [fx - x0, fy - y0];
      for (let c = 0; c < 4; c++) {
        const top = read(x0, y0, c) * (1 - ax) + read(x0 + 1, y0, c) * ax;
        const bottom = read(x0, y0 + 1, c) * (1 - ax) + read(x0 + 1, y0 + 1, c) * ax;
        rgba[(y * width + x) * 4 + c] = Math.round(top * (1 - ay) + bottom * ay);
      }
    }
  }
  return { width, height, rgba };
}

/** Lines a painting up with its geometry when that lines its gaps up clearly better; else leaves it. */
export function register(picture: Picture, geometry: Geometry, tiles: GeometryCell[]): { picture: Picture; registration: Registration } {
  const registration = findRegistration(picture, geometry, tiles);
  const moved = registration.scaleX !== 1 || registration.scaleY !== 1 || registration.shiftX !== 0 || registration.shiftY !== 0;
  if (!moved || registration.after < registration.before + 0.05) return { picture, registration: { ...registration, scaleX: 1, scaleY: 1, shiftX: 0, shiftY: 0, after: registration.before } };
  return { picture: applyRegistration(picture, geometry, registration), registration };
}
