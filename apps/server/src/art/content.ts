/**
 * What each painted tile shows. SAM checks that a tile sits where the guide put it, but it cannot
 * tell a wheat field painted where the guide asked for a forest, and the image model sometimes
 * swaps terrains. So each source tile's colors are compared with the other tiles': a tile that
 * looks far more like another kind's tiles than like the rest of its own moves to that kind.
 */

export interface Picture {
  width: number;
  height: number;
  rgba: Uint8Array;
}

type Lab = [number, number, number];

/** CIE Lab of an sRGB color, so distances follow what the eye sees. */
function lab(r: number, g: number, b: number): Lab {
  const linear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047);
  const y = f(0.2126 * lr + 0.7152 * lg + 0.0722 * lb);
  const z = f((0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const distance = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const mean = (colors: Lab[]): Lab => {
  const sum = colors.reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]] as Lab, [0, 0, 0]);
  return [sum[0] / colors.length, sum[1] / colors.length, sum[2] / colors.length];
};

/**
 * Mean color of a disc of radius `r` around (x, y), in board units, on a painting that covers
 * `width` × `height` board units.
 */
export function discColor(picture: Picture, width: number, height: number, [x, y]: [number, number], r: number): Lab {
  const [sx, sy] = [picture.width / width, picture.height / height];
  const [px, py, rx, ry] = [x * sx, y * sy, r * sx, r * sy];
  // About 2,000 samples, whatever the painting's size.
  const step = Math.max(1, Math.floor(Math.sqrt((Math.PI * rx * ry) / 2000)));
  let [red, green, blue, n] = [0, 0, 0, 0];
  for (let j = Math.max(0, Math.ceil(py - ry)); j <= Math.min(picture.height - 1, py + ry); j += step) {
    for (let i = Math.max(0, Math.ceil(px - rx)); i <= Math.min(picture.width - 1, px + rx); i += step) {
      if (((i - px) / rx) ** 2 + ((j - py) / ry) ** 2 > 1) continue;
      const at = (j * picture.width + i) * 4;
      [red, green, blue, n] = [red + picture.rgba[at], green + picture.rgba[at + 1], blue + picture.rgba[at + 2], n + 1];
    }
  }
  return n ? lab(red / n, green / n, blue / n) : [0, 0, 0];
}

export interface Relabel {
  at: [number, number];
  from: string;
  to: string;
}

/** A tile moves only when it is less than this share as far from another kind as from its own. */
const MARGIN = 0.5;
/** Kinds whose tiles differ by less than this (Lab units) are too alike to tell apart. */
const ALIKE = 12;

/**
 * Moves each source tile whose painting clearly matches another kind's tiles better than its own
 * kind's other tiles to that kind. A tile alone in its kind has nothing of its own to compare
 * with: it moves only when it looks just like another kind's tiles, since every kind was meant to
 * look different. A kind left with no tiles is drawn plain.
 */
export function relabelSources(
  picture: Picture,
  width: number,
  height: number,
  sources: Record<string, [number, number][]>,
): { sources: Record<string, [number, number][]>; moved: Relabel[] } {
  const tiles = Object.entries(sources).flatMap(([kind, list]) => list.map((at) => ({ kind, at, from: kind })));
  if (tiles.length < 2) return { sources, moved: [] };
  // Sample the middle of each tile: a third of the distance to its nearest neighbor.
  const nearest = tiles.map((t) => Math.min(...tiles.filter((u) => u !== t).map((u) => Math.hypot(u.at[0] - t.at[0], u.at[1] - t.at[1]))));
  const r = 0.3 * [...nearest].sort((a, b) => a - b)[Math.floor(nearest.length / 2)];
  const colors = tiles.map((t) => discColor(picture, width, height, t.at, r));
  const kinds = Object.keys(sources);

  for (let round = 0; round < 4; round++) {
    let changed = false;
    const groups = new Map(kinds.map((k) => [k, tiles.flatMap((t, i) => (t.kind === k ? [i] : []))]));
    tiles.forEach((tile, i) => {
      const own = groups.get(tile.kind)!.filter((j) => j !== i);
      const home = own.length ? distance(colors[i], mean(own.map((j) => colors[j]))) : undefined;
      if (home !== undefined && home < ALIKE) return;
      let best: { kind: string; d: number } | undefined;
      for (const [kind, members] of groups) {
        if (kind === tile.kind || members.length === 0) continue;
        const d = distance(colors[i], mean(members.map((j) => colors[j])));
        if (!best || d < best.d) best = { kind, d };
      }
      if (best && (home === undefined ? best.d < ALIKE / 2 : best.d < MARGIN * home)) {
        tile.kind = best.kind;
        changed = true;
      }
    });
    if (!changed) break;
  }

  const result: Record<string, [number, number][]> = Object.fromEntries(kinds.map((k) => [k, []]));
  for (const t of tiles) result[t.kind].push(t.at);
  return { sources: result, moved: tiles.filter((t) => t.kind !== t.from).map((t) => ({ at: t.at, from: t.from, to: t.kind })) };
}
