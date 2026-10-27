/**
 * Square-grid helpers: bounds, neighbors, k-in-a-row lines and gravity drops.
 * Cells are stored in a flat row-major array; y = 0 is the top row.
 */

export interface GridShape {
  width: number;
  height: number;
}

export const ORTHOGONAL = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export const DIAGONAL = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/** One direction per line axis; line checks scan each axis both ways. */
export const LINE_AXES = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

export const inBounds = (g: GridShape, x: number, y: number) => x >= 0 && y >= 0 && x < g.width && y < g.height;

export const toIndex = (g: GridShape, x: number, y: number) => y * g.width + x;

export const fromIndex = (g: GridShape, i: number) => ({ x: i % g.width, y: Math.floor(i / g.width) });

export function neighbors(
  g: GridShape,
  x: number,
  y: number,
  dirs: readonly (readonly [number, number])[] = ORTHOGONAL,
): { x: number; y: number }[] {
  return dirs.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter((p) => inBounds(g, p.x, p.y));
}

/** Length of the run of equal values through (x, y) along one axis, counting both directions. */
export function runLength<T>(g: GridShape, cells: readonly T[], x: number, y: number, dx: number, dy: number): number {
  const value = cells[toIndex(g, x, y)];
  let length = 1;
  for (const sign of [1, -1]) {
    let cx = x + dx * sign;
    let cy = y + dy * sign;
    while (inBounds(g, cx, cy) && cells[toIndex(g, cx, cy)] === value) {
      length++;
      cx += dx * sign;
      cy += dy * sign;
    }
  }
  return length;
}

/** True if the value at (x, y) is part of a straight line of at least k equal values. */
export function completesLine<T>(g: GridShape, cells: readonly T[], x: number, y: number, k: number): boolean {
  return LINE_AXES.some(([dx, dy]) => runLength(g, cells, x, y, dx, dy) >= k);
}

/** Index of the lowest empty (null) cell in column x, or undefined if the column is full. */
export function dropTarget<T>(g: GridShape, cells: readonly (T | null)[], x: number): number | undefined {
  for (let y = g.height - 1; y >= 0; y--) {
    if (cells[toIndex(g, x, y)] === null) return toIndex(g, x, y);
  }
  return undefined;
}
