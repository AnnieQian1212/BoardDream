import type { Rng } from "@boarddream/engine";
import { draw } from "./deck";

/** A face-up row of cards that refills from a draw pile (reshuffling discards when it runs out). */

export interface Market<T> {
  row: T[];
  drawPile: T[];
  discard: T[];
}

/** Tops the row back up to `size` cards, as far as the piles allow. */
export function refill<T>(rng: Rng, market: Market<T>, size: number): Market<T> {
  const missing = Math.max(0, size - market.row.length);
  const { drawn, drawPile, discard } = draw(rng, market, missing);
  return { row: [...market.row, ...drawn], drawPile, discard };
}

/** Takes the card at `index` and refills the row. */
export function take<T>(rng: Rng, market: Market<T>, index: number, size: number): { card: T; market: Market<T> } {
  const card = market.row[index];
  const row = market.row.filter((_, i) => i !== index);
  return { card, market: refill(rng, { ...market, row }, size) };
}

/** Draws blind from the pile instead of the row. */
export function drawBlind<T>(rng: Rng, market: Market<T>, n: number): { cards: T[]; market: Market<T> } {
  const { drawn, drawPile, discard } = draw(rng, market, n);
  return { cards: drawn, market: { ...market, drawPile, discard } };
}
