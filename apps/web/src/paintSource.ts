import type { GeometryCell } from "@boarddream/engine";

/** A painted board (apps/server/src/art/board.ts): the image, its size in board units, and its painted tiles by kind. */
export interface BoardPaint {
  url: string;
  width: number;
  height: number;
  sources: Record<string, [number, number][]>;
}

/**
 * Share of a painted tile a tile shows: the painter draws thick inked gaps between tiles, which the
 * board's own gaps and outlines already draw, so a tile shows its painting without them.
 */
export const ART_CROP = 0.84;

const centroid = (polygon: [number, number][]): [number, number] => [
  polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length,
  polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length,
];

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

const words = (kind: string) => kind.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * The painted kind a tile wears: its own, or, for a tile whose kind names a state of a painted kind,
 * that kind. Fogfall Lanterns' lanterns, painted at night as "lantern", become "dark-lantern" and
 * "lit-lantern" at dawn, and lost their painting for the rest of the game. Of several painted kinds
 * a tile's kind names, the longest is taken.
 */
export function paintedKind(paint: BoardPaint | undefined, cell: GeometryCell): string | undefined {
  const kind = cell.kind ?? "plain";
  if (!paint) return undefined;
  if (paint.sources[kind]?.length) return kind;
  const own = words(kind);
  return Object.keys(paint.sources)
    .filter((painted) => paint.sources[painted].length > 0 && words(painted).length > 0 && words(painted).every((w) => own.includes(w)))
    .sort((a, b) => b.length - a.length)[0];
}

/** Words for a thing put out or shut: a tile so named wears its kind's painting darkened ("dark-lantern"). */
const DARK = new Set(["dark", "unlit", "snuffed", "doused", "out", "dim", "off", "closed"]);

/** Whether a tile wears another kind's painting as a dark state of it. */
export function darkened(paint: BoardPaint | undefined, cell: GeometryCell): boolean {
  const worn = paintedKind(paint, cell);
  return worn !== undefined && worn !== (cell.kind ?? "plain") && words(cell.kind ?? "").some((w) => DARK.has(w));
}

/**
 * Where a tile's painting comes from: a painted tile of its kind, picked stably by the tile's id, as
 * large as this tile or larger. A tile samples the painting around the source's middle, so a source
 * smaller than the tile showed the bare board past its edge: Highsail's Mistwood hex, painted from a
 * small action space the color check had judged green, showed a cream band. With no source that
 * large, the tile shows its own place in the painting.
 */
export function sourceFor(paint: BoardPaint | undefined, cell: GeometryCell, cells: GeometryCell[]): [number, number] | undefined {
  // Edge-matched tiles show their terrain segments, never painted art.
  if (cell.segments) return undefined;
  const kind = paintedKind(paint, cell);
  const sources = kind === undefined ? undefined : paint?.sources[kind];
  if (!sources?.length) return undefined;
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  const extent = (polygon: [number, number][]) => [spread(polygon.map(([x]) => x)), spread(polygon.map(([, y]) => y))];
  const [w, h] = extent(cell.polygon);
  const large = sources.filter(([x, y]) => {
    const from = cells.find((c) => {
      const [cx, cy] = centroid(c.polygon);
      return Math.hypot(cx - x, cy - y) < 0.05;
    });
    if (!from) return true;
    const [fw, fh] = extent(from.polygon);
    return fw >= w * 0.95 && fh >= h * 0.95;
  });
  return large.length ? large[hash(cell.id) % large.length] : centroid(cell.polygon);
}
