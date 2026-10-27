import type { GeometryCell } from "@boarddream/engine";

/**
 * Rhombus board of pointy-top hexagons in axial coordinates (q, r), as used by connection games.
 * Cells are stored row-major: index = r * size + q.
 */

export const HEX_DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
] as const;

const SQRT3 = Math.sqrt(3);

export const hexIndex = (size: number, q: number, r: number) => r * size + q;

export const hexCoords = (size: number, index: number) => ({ q: index % size, r: Math.floor(index / size) });

export const hexCellId = (q: number, r: number) => `h${q},${r}`;

export function hexNeighbors(size: number, index: number): number[] {
  const { q, r } = hexCoords(size, index);
  return HEX_DIRECTIONS.map(([dq, dr]) => [q + dq, r + dr])
    .filter(([nq, nr]) => nq >= 0 && nr >= 0 && nq < size && nr < size)
    .map(([nq, nr]) => hexIndex(size, nq, nr));
}

/** Center of hex (q, r) for hexagons of circumradius `radius`, offset so the board starts at (0, 0). */
export function hexCenter(q: number, r: number, radius: number): [number, number] {
  return [radius * SQRT3 * (q + r / 2) + (radius * SQRT3) / 2, radius * 1.5 * r + radius];
}

export function hexPolygon(cx: number, cy: number, radius: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

/** Cells for a size x size rhombus, plus the board's bounding size. */
export function rhombusBoard(size: number, radius = 0.5): { cells: GeometryCell[]; width: number; height: number } {
  const cells: GeometryCell[] = [];
  for (let r = 0; r < size; r++) {
    for (let q = 0; q < size; q++) {
      const [cx, cy] = hexCenter(q, r, radius);
      cells.push({ id: hexCellId(q, r), polygon: hexPolygon(cx, cy, radius) });
    }
  }
  return { cells, width: radius * SQRT3 * (1.5 * size - 0.5), height: radius * (1.5 * size + 0.5) };
}
