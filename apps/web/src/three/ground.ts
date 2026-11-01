import type { GeometryCell } from "@boarddream/engine";
import { playerColor, TILE_COLORS } from "../colors";
import { growthOf, type Growth } from "./growth";
import { hash, mix } from "./paint";
import { isWaterCell, isWaterKind } from "./water";

/**
 * The colors a board's tiles are drawn in, shared by the 3D table and the flat board: a kind's own
 * color, else its ground's (a meadow green, a lake blue), else a soft color picked from the kind's
 * name. A kind that names a group (a borough on grass) shows as a colored rim around the ground.
 */

/** What a whole cell's ground is: water, or what grows on it. */
export type Ground = Growth | "water";

export function groundOf(cell: GeometryCell): Ground | undefined {
  if (cell.segments || cell.kind === "label" || SPOTS.has(cell.kind ?? "")) return undefined;
  if (isWaterCell(cell)) return "water";
  return growthOf(cell.kind, cell.terrain);
}

export const GROUND_COLORS: Record<Ground, string> = {
  // A little darker than the grass and wheat that grow on them, so the sunlit tips stand out.
  meadow: "#86a85a",
  forest: "#6a9152",
  field: "#dcb766",
  rock: "#beb7a9",
  water: "#7fbad6",
};

/** The sandy rim a pool of water leaves on its tile. */
export const SHORE = "#e8d6a6";

export const CREAM = "#f3ead8";
const SPOTS = new Set(["vertex", "edge"]);

/** Soft colors for kinds a generated game invents (obsidian, caldera, ...). */
const UNKNOWN = ["#c98b6b", "#8fb0c9", "#b5a3cf", "#d9b86c", "#93b98a", "#c99aa8", "#8fc1b8", "#b8a58f"];
/** Group rims, in an order that keeps clear of the grounds they run round (blue water, green grass). */
const RIMS = ["#cf7f5c", "#a58ccc", "#ddb24e", "#d08aa2", "#9a7f66", "#e8e0cc", "#6f8aa8", "#5f9e8f"];

/** A kind's own color; kinds a generated game invents get a stable soft one. */
export function kindColor(kind: string): string {
  if (TILE_COLORS[kind]) return TILE_COLORS[kind];
  return kind ? mix(UNKNOWN[hash(kind) % UNKNOWN.length], CREAM, 0.35) : CREAM;
}

export function tileColor(cell: GeometryCell): string {
  // Roads and buildings spots take the full seat color; owned tiles get a tint.
  if (cell.owner !== undefined) return SPOTS.has(cell.kind ?? "") ? playerColor(cell.owner) : mix(playerColor(cell.owner), CREAM, 0.5);
  return ownColor(cell);
}

/** A cell's color whoever holds it: its kind's own, else its ground's, else one from its kind's name. */
export function ownColor(cell: GeometryCell): string {
  if (cell.segments) return CREAM;
  const kind = cell.kind ?? "";
  if (TILE_COLORS[kind]) return TILE_COLORS[kind];
  const ground = groundOf(cell);
  return ground ? GROUND_COLORS[ground] : kindColor(kind);
}

/**
 * Rim colors by cell id, for cells whose terrain hint gives their ground while their kind names a
 * group (borough-1, north-province): the tile shows its ground and the group as a rim. Only on a
 * board with two groups or more, where the rims tell them apart; each group gets its own color.
 */
export function zoneColors(cells: GeometryCell[]): Map<string, string> {
  const zoned = cells.filter(
    (c) => c.terrain && !c.segments && c.kind && c.kind !== "label" && !TILE_COLORS[c.kind] && !growthOf(c.kind) && !isWaterKind(c.kind),
  );
  const kinds = [...new Set(zoned.map((c) => c.kind!))].sort();
  if (kinds.length < 2) return new Map();
  return new Map(zoned.map((c) => [c.id, RIMS[kinds.indexOf(c.kind!) % RIMS.length]]));
}
