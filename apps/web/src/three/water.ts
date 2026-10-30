/**
 * Water on the board. Cells whose kind names water (a sea, a lagoon, a reef) share one height grid,
 * kept on the CPU and stepped at a fixed rate while anything ripples. Dry nodes stay flat, so waves
 * bounce off the shore instead of running under the land, and a still surface costs nothing.
 */

import type { GeometryCell } from "@boarddream/engine";

const WATER_WORDS =
  /(^|[-_ ])(sea|seas|ocean|lagoon|reef|lake|river|water|waters|pond|bay|harbor|harbour|marsh|fen|shoal|shoals|strait|shallows|cove|tarn|loch|wetlands?|swamp|bog|mire|headwaters?|estuary|fjord|creek|brook|stream|canal|waterfall)($|[-_ ])/;

export const isWaterKind = (kind: string | undefined): boolean => kind !== undefined && WATER_WORDS.test(kind.toLowerCase());

/** A whole cell is water by its terrain hint (GeometryCell.terrain), or else by its kind's name. */
export const isWaterCell = (cell: GeometryCell): boolean => (cell.terrain ? cell.terrain === "water" : isWaterKind(cell.kind));

/**
 * Where a cell holds water, as polygons around its center in board units: the whole cell shrunk
 * to `share`, or an edge-matched tile's water wedges shrunk to `wedge`. Neighboring water wedges
 * join into one fan, so no dry seam runs between them.
 */
export function waterPolygons(cell: GeometryCell, share: number, wedge: number): Polygon[] {
  const n = cell.polygon.length;
  const cx = cell.polygon.reduce((sum, [x]) => sum + x, 0) / n;
  const cy = cell.polygon.reduce((sum, [, y]) => sum + y, 0) / n;
  const corner = (i: number, f: number): [number, number] => [(cell.polygon[i % n][0] - cx) * f, (cell.polygon[i % n][1] - cy) * f];
  if (!cell.segments) return isWaterCell(cell) ? [cell.polygon.map((_, i) => corner(i, share))] : [];
  const wet = cell.segments.map((kind) => isWaterKind(kind));
  if (wet.every(Boolean)) return [cell.polygon.map((_, i) => corner(i, wedge))];
  // Runs of water wedges, starting just after a dry one so no run wraps past the end.
  const start = wet.indexOf(false) + 1;
  const fans: Polygon[] = [];
  for (let j = 0; j < n; j++) {
    const i = (start + j) % n;
    if (!wet[i]) continue;
    if (j === 0 || !wet[(i + n - 1) % n]) fans.push([[0, 0], corner(i, wedge)]);
    fans[fans.length - 1].push(corner(i + 1, wedge));
  }
  return fans;
}

/** How the texture packs slopes and curvature into bytes; the water shader reads them back. */
export const SLOPE_GAIN = 2;
export const CURVE_GAIN = 3;

/** Steps per second. Each step a wave moves about one grid node. */
export const STEP_RATE = 60;
/** Amplitude kept per step: ripples fade within a few seconds. */
const DAMPING = 0.98;
/** Below this the surface counts as still (too flat to see): the grid stops and the table stops drawing frames. */
const REST = 0.01;
/** Nodes from the shore over which the water deepens. */
const SHORE_NODES = 6;
const MAX_NODES = 40_000;

type Polygon = [number, number][];

function inside(polygon: Polygon, x: number, z: number): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

export class WaterGrid {
  readonly cols: number;
  readonly rows: number;
  /** Corner of the grid and the distance between nodes, in the board's world units. */
  readonly x0: number;
  readonly z0: number;
  readonly spacing: number;
  /** RGBA per node for the water texture: slope x, slope z, curvature, and depth from the shore. */
  readonly pixels: Uint8Array;
  private readonly wet: Uint8Array;
  private readonly depth: Float32Array;
  private height: Float32Array;
  private previous: Float32Array;
  private moving = false;

  /** `polygons` are the water's outlines in board-local world units (x, z). */
  constructor(polygons: Polygon[], spacing: number) {
    let [minX, minZ, maxX, maxZ] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const polygon of polygons)
      for (const [x, z] of polygon) [minX, minZ, maxX, maxZ] = [Math.min(minX, x), Math.min(minZ, z), Math.max(maxX, x), Math.max(maxZ, z)];
    // A large sea gets coarser nodes rather than a grid too big to step every frame.
    const span = (maxX - minX) * (maxZ - minZ);
    this.spacing = Math.max(spacing, Math.sqrt(span / (MAX_NODES * 0.9)));
    // A dry margin on every side, so each wet node has four neighbors.
    this.x0 = minX - this.spacing;
    this.z0 = minZ - this.spacing;
    this.cols = Math.ceil((maxX - minX) / this.spacing) + 3;
    this.rows = Math.ceil((maxZ - minZ) / this.spacing) + 3;
    const n = this.cols * this.rows;
    this.wet = new Uint8Array(n);
    for (const polygon of polygons) {
      const xs = polygon.map(([x]) => x);
      const zs = polygon.map(([, z]) => z);
      const [c0, c1] = [Math.floor((Math.min(...xs) - this.x0) / this.spacing), Math.ceil((Math.max(...xs) - this.x0) / this.spacing)];
      const [r0, r1] = [Math.floor((Math.min(...zs) - this.z0) / this.spacing), Math.ceil((Math.max(...zs) - this.z0) / this.spacing)];
      for (let r = Math.max(1, r0); r <= Math.min(this.rows - 2, r1); r++)
        for (let c = Math.max(1, c0); c <= Math.min(this.cols - 2, c1); c++)
          if (inside(polygon, this.x0 + c * this.spacing, this.z0 + r * this.spacing)) this.wet[r * this.cols + c] = 1;
    }
    this.depth = this.shoreDepth();
    this.height = new Float32Array(n);
    this.previous = new Float32Array(n);
    this.pixels = new Uint8Array(n * 4);
    this.encode();
  }

  get still(): boolean {
    return !this.moving;
  }

  isWet(x: number, z: number): boolean {
    const c = Math.round((x - this.x0) / this.spacing);
    const r = Math.round((z - this.z0) / this.spacing);
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.wet[r * this.cols + c] === 1;
  }

  /** Push the surface down around (x, z): a dip that spreads as a ring. `radius` is in grid nodes. */
  disturb(x: number, z: number, strength: number, radius = 2.5): void {
    const cx = (x - this.x0) / this.spacing;
    const cz = (z - this.z0) / this.spacing;
    const reach = Math.ceil(radius);
    for (let r = Math.round(cz) - reach; r <= Math.round(cz) + reach; r++) {
      for (let c = Math.round(cx) - reach; c <= Math.round(cx) + reach; c++) {
        if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) continue;
        const i = r * this.cols + c;
        const d = Math.hypot(c - cx, r - cz) / radius;
        if (!this.wet[i] || d >= 1) continue;
        this.height[i] -= strength * 0.5 * (1 + Math.cos(Math.PI * d));
        this.moving = true;
      }
    }
  }

  /** One fixed step of the wave equation. Returns whether the water is still moving. */
  step(): boolean {
    if (!this.moving) return false;
    const { cols, rows, wet } = this;
    const h = this.height;
    const next = this.previous;
    let peak = 0;
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1, i = r * cols + 1; c < cols - 1; c++, i++) {
        if (!wet[i]) continue;
        const v = ((h[i - 1] + h[i + 1] + h[i - cols] + h[i + cols]) * 0.5 - next[i]) * DAMPING;
        next[i] = v;
        peak = Math.max(peak, Math.abs(v));
      }
    }
    this.previous = h;
    this.height = next;
    if (peak < REST) {
      this.height.fill(0);
      this.previous.fill(0);
      this.moving = false;
    }
    return this.moving;
  }

  /** Writes the surface into `pixels`, for the texture the water shader reads. */
  encode(): void {
    const { cols, rows, wet, depth, pixels } = this;
    const h = this.height;
    const byte = (v: number) => Math.max(0, Math.min(255, Math.round(128 + v * 127)));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (!wet[i] || r === 0 || c === 0 || r === rows - 1 || c === cols - 1) {
          pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = 128;
          pixels[i * 4 + 3] = 0;
          continue;
        }
        pixels[i * 4] = byte((h[i + 1] - h[i - 1]) * 0.5 * SLOPE_GAIN);
        pixels[i * 4 + 1] = byte((h[i + cols] - h[i - cols]) * 0.5 * SLOPE_GAIN);
        pixels[i * 4 + 2] = byte((h[i - 1] + h[i + 1] + h[i - cols] + h[i + cols] - 4 * h[i]) * CURVE_GAIN);
        pixels[i * 4 + 3] = Math.round(depth[i] * 255);
      }
    }
  }

  /** For each wet node, how far it lies from dry ground, as 0 at the shore to 1 a few nodes out. */
  private shoreDepth(): Float32Array {
    const { cols, rows, wet } = this;
    const steps = new Int32Array(cols * rows).fill(-1);
    let frontier: number[] = [];
    for (let i = 0; i < wet.length; i++) if (!wet[i]) (steps[i] = 0), frontier.push(i);
    for (let d = 1; d <= SHORE_NODES && frontier.length; d++) {
      const next: number[] = [];
      for (const i of frontier) {
        const c = i % cols;
        for (const j of [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, i - cols, i + cols]) {
          if (j < 0 || j >= wet.length || steps[j] !== -1) continue;
          steps[j] = d;
          next.push(j);
        }
      }
      frontier = next;
    }
    return Float32Array.from(steps, (s, i) => (wet[i] ? (s === -1 ? 1 : (s - 1) / (SHORE_NODES - 1)) : 0));
  }
}
