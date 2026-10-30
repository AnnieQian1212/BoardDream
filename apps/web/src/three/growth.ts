import type { GeometryCell } from "@boarddream/engine";
import { hash, seeded } from "./paint";

/**
 * Growth on the board. Grassland grows bright grass with flowers, forest darker grass under a few
 * trees, grain fields rows of wheat with poppies, and stony ground boulders, stones and tufts of
 * grass. This file only decides where things grow, in board units relative to the cell's center;
 * Grass.tsx draws them.
 */
export type Growth = "meadow" | "forest" | "field" | "rock";

const FOREST = /(forest|woodland|grove|jungle|thicket|mistwood|(^|[-_ ])woods?($|[-_ ]))/;
const FIELD = /(wheat|grain|barley|farmland|cropland|(^|[-_ ])(fields?|farms?|crops?|corn|rye|oats|millet|paddy|paddies)($|[-_ ]))/;
const ROCK = /(quarr(y|ies)|stone|rock|boulder|crag|cliff|scree|mountain|granite|marble|basalt|rubble|(^|[-_ ])(peaks?|mines?|ore|mesa)($|[-_ ]))/;
const MEADOW = /(grass|meadow|pasture|prairie|steppe|savann|lawn|glade|(^|[-_ ])(plains?|green)($|[-_ ]))/;

export function growthOf(kind: string | undefined): Growth | undefined {
  const k = kind?.toLowerCase() ?? "";
  if (FOREST.test(k)) return "forest";
  if (FIELD.test(k)) return "field";
  if (ROCK.test(k)) return "rock";
  if (MEADOW.test(k)) return "meadow";
  return undefined;
}

/** How tall each growth stands, relative to grass: the name's clearing grows with it. */
export const HEIGHT: Record<Growth, number> = { meadow: 1, forest: 1.15, field: 1.5, rock: 0.7 };

/** Share of a cell's area each growth fills with clumps: stony ground grows only a few tufts and stones. */
const COVER: Record<Growth, number> = { meadow: 1, forest: 1, field: 1, rock: 0.25 };

/** The growths on a cell: its own, or those of an edge-matched tile's wedges. */
export const growthsOf = (cell: GeometryCell): Growth[] =>
  [...new Set((cell.segments ?? [cell.kind]).map(growthOf))].filter((g): g is Growth => g !== undefined);

type Point = [number, number];

export function inside(polygon: Point[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export const centroid = (polygon: Point[]): Point => [
  polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length,
  polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length,
];

/**
 * What grows at a point of a cell, relative to its center, on the part of the cell the tile covers
 * (`share` of it). An edge-matched tile grows on the wedges whose terrain is green.
 */
export function growthField(cell: GeometryCell, share: number): ((x: number, y: number) => Growth | undefined) | undefined {
  const [cx, cy] = centroid(cell.polygon);
  const corners = cell.polygon.map(([x, y]): Point => [(x - cx) * share, (y - cy) * share]);
  if (cell.segments) {
    const kinds = cell.segments.map(growthOf);
    if (!kinds.some(Boolean)) return undefined;
    return (x, y) => {
      for (let i = 0; i < corners.length; i++) {
        if (!kinds[i]) continue;
        if (inside([[0, 0], corners[i], corners[(i + 1) % corners.length]], x, y)) return kinds[i];
      }
      return undefined;
    };
  }
  const growth = growthOf(cell.kind);
  return growth && ((x, y) => (inside(corners, x, y) ? growth : undefined));
}

export interface Sprout {
  x: number;
  y: number;
  /** Turn about the vertical axis, in radians. */
  turn: number;
  /** Size relative to an average clump. */
  size: number;
  growth: Growth;
}

/**
 * The bare patch at a cell's center where its name is printed (and a piece may stand): an ellipse's
 * radii and how far its middle sits toward the camera (larger y), since grass in front of the name
 * hides it and grass behind does not. `blade` is the grass's height, in board units.
 */
export function clearing(cell: GeometryCell, unit: number, blade: number): Clearing {
  if (!cell.label) return [0.16 * unit, 0.12 * unit + blade * 0.4, blade * 0.4];
  // Close to how boardPrint sizes the name: about 0.3 units tall, at most 80% of the cell wide.
  const xs = cell.polygon.map(([x]) => x);
  const text = Math.min(0.8 * (Math.max(...xs) - Math.min(...xs)), cell.label.length * 0.17 * unit);
  return [text / 2 + 0.08 * unit, 0.2 * unit + blade * 0.45, blade * 0.45];
}

export type Clearing = [rx: number, ry: number, shift: number];

/**
 * Clumps on a jittered grid, `spacing` apart, wherever the field grows something and outside the
 * clearing; wheat keeps to its rows. Seeded by the cell's id, so a cell grows the same way every
 * time it is drawn.
 */
export function sow(cell: GeometryCell, field: (x: number, y: number) => Growth | undefined, spacing: number, bare: Clearing): Sprout[] {
  const random = seeded(hash(cell.id));
  const [cx, cy] = centroid(cell.polygon);
  const xs = cell.polygon.map(([x]) => x - cx);
  const ys = cell.polygon.map(([, y]) => y - cy);
  const sprouts: Sprout[] = [];
  for (let gy = Math.min(...ys); gy < Math.max(...ys); gy += spacing) {
    for (let gx = Math.min(...xs); gx < Math.max(...xs); gx += spacing) {
      const x = gx + random() * spacing;
      const rows = field(gx + spacing / 2, gy + spacing / 2) === "field";
      const y = gy + (rows ? 0.4 + random() * 0.2 : random()) * spacing;
      const turn = random() * Math.PI * 2;
      const size = 0.75 + random() * 0.5;
      // Thinning toward the clearing's edge makes it a soft patch rather than a cut-out.
      const e = (x / bare[0]) ** 2 + ((y - bare[2]) / bare[1]) ** 2;
      if (e < 1 || (e < 1.6 && random() > (e - 1) / 0.6)) continue;
      const growth = field(x, y);
      if (growth) sprouts.push({ x, y, turn, size, growth });
    }
  }
  return sprouts;
}

/**
 * A few large things among the clumps (trees in a forest, boulders on stony ground): spread out,
 * back from the cell's edge, and never in front of the cell's name (the camera looks from larger
 * y), only behind it or beside it.
 */
export function plant(
  sprouts: Sprout[],
  field: (x: number, y: number) => Growth | undefined,
  bare: Clearing,
  spacing: number,
  count: number,
  growth: Growth = "forest",
): Sprout[] {
  const trees: Sprout[] = [];
  // Sprouts come row by row; their random turns give an order that favors no side of the cell.
  for (const s of [...sprouts].sort((a, b) => a.turn - b.turn)) {
    if (trees.length >= count) break;
    if (s.growth !== growth || field(s.x * 1.35, s.y * 1.35) !== growth) continue;
    if (Math.abs(s.x) < bare[0] + spacing * 2 && s.y > bare[2] - bare[1] - spacing) continue;
    if (trees.some((t) => Math.hypot(t.x - s.x, t.y - s.y) < spacing * 4)) continue;
    trees.push(s);
  }
  return trees;
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const widthOf = (cell: GeometryCell) => Math.max(...cell.polygon.map(([x]) => x)) - Math.min(...cell.polygon.map(([x]) => x));

/** A typical growing cell's width, in board units: grass and trees are sized from it. */
export function cellSize(cells: GeometryCell[]): number {
  const green = cells.filter((c) => c.kind !== "label" && growthsOf(c).length > 0);
  return green.length ? median(green.map(widthOf)) : 1;
}

/** The unit boardPrint sizes names in (a typical cell's width, at least 1), for the clearings. */
export function printUnit(cells: GeometryCell[]): number {
  const tiles = cells.filter((c) => c.kind !== "label");
  return Math.max(1, tiles.length ? median(tiles.map(widthOf)) : 1);
}

const MAX_CLUMPS = 9000;

/** Distance between clumps, in board units: denser at higher `density`, sparser on a board with a lot of growth. */
export function grassSpacing(cells: GeometryCell[], size: number, density: number): number {
  const spacing = (0.055 * size) / Math.sqrt(density);
  let area = 0;
  for (const cell of cells) {
    const cover = (kind: string | undefined) => {
      const growth = growthOf(kind);
      return growth ? COVER[growth] : 0;
    };
    const green = cell.segments ? cell.segments.reduce((sum, s) => sum + cover(s), 0) / cell.segments.length : cover(cell.kind);
    if (!green) continue;
    const p = cell.polygon;
    let twice = 0;
    for (let i = 0; i < p.length; i++) twice += p[i][0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * p[i][1];
    area += (Math.abs(twice) / 2) * green;
  }
  const clumps = area / spacing ** 2;
  const budget = MAX_CLUMPS * Math.min(1, density);
  return clumps > budget ? spacing * Math.sqrt(clumps / budget) : spacing;
}
