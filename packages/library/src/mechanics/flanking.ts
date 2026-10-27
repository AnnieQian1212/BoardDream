import { DIAGONAL, inBounds, ORTHOGONAL, toIndex, type GridShape } from "./grid";

/** Reversi-style capture: placing a piece flips every straight run of rivals it closes off. */

const EIGHT_DIRECTIONS = [...ORTHOGONAL, ...DIAGONAL];

/**
 * Indices that placing `player` at (x, y) would flip: unbroken runs of other players' pieces that
 * end in one of `player`'s own pieces. Empty when the cell is taken or nothing would flip.
 */
export function flips<T>(g: GridShape, cells: readonly (T | null)[], x: number, y: number, player: T): number[] {
  if (cells[toIndex(g, x, y)] !== null) return [];
  const flipped: number[] = [];
  for (const [dx, dy] of EIGHT_DIRECTIONS) {
    const run: number[] = [];
    let cx = x + dx;
    let cy = y + dy;
    while (inBounds(g, cx, cy) && cells[toIndex(g, cx, cy)] !== null && cells[toIndex(g, cx, cy)] !== player) {
      run.push(toIndex(g, cx, cy));
      cx += dx;
      cy += dy;
    }
    if (run.length > 0 && inBounds(g, cx, cy) && cells[toIndex(g, cx, cy)] === player) flipped.push(...run);
  }
  return flipped;
}

/** Every cell where `player` can place, with what it would flip. */
export function placements<T>(g: GridShape, cells: readonly (T | null)[], player: T): { index: number; flips: number[] }[] {
  const out: { index: number; flips: number[] }[] = [];
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const flipped = flips(g, cells, x, y, player);
      if (flipped.length > 0) out.push({ index: toIndex(g, x, y), flips: flipped });
    }
  }
  return out;
}
