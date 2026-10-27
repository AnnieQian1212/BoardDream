import type { GeometryCell } from "@boarddream/engine";

/** A looping track of squares: each player enters at their own start square and goes once around. */

/** Square index `progress` steps after `start` on a loop of `length` squares. */
export const loopSquare = (start: number, progress: number, length: number) => (start + progress) % length;

/** Evenly spaced start squares, one per player. */
export const startSquares = (numPlayers: number, length: number) =>
  Array.from({ length: numPlayers }, (_, i) => Math.round((i * length) / numPlayers) % length);

export interface Ring {
  cx: number;
  cy: number;
  inner: number;
  outer: number;
}

/** Point at position `t` along the loop (in squares, may be fractional) and radius `r`. Square 0 is at the bottom. */
export function ringPoint(ring: Ring, length: number, t: number, r: number): [number, number] {
  const angle = Math.PI / 2 + (2 * Math.PI * t) / length;
  return [ring.cx + r * Math.cos(angle), ring.cy + r * Math.sin(angle)];
}

/** One ring-segment cell per square, with ids "t0", "t1", ... */
export function ringCells(ring: Ring, length: number): GeometryCell[] {
  return Array.from({ length }, (_, i) => ({
    id: squareId(i),
    polygon: [
      ringPoint(ring, length, i, ring.inner),
      ringPoint(ring, length, i, ring.outer),
      ringPoint(ring, length, i + 1, ring.outer),
      ringPoint(ring, length, i + 1, ring.inner),
    ],
  }));
}

export const squareId = (square: number) => `t${square}`;
