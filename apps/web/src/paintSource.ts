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
  const sources = paint?.sources[cell.kind ?? "plain"];
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
