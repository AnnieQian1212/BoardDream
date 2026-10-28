import type { Rng } from "@boarddream/engine";
import { draw } from "./deck";
import { lookup, type Buildings, type HexMap } from "./hexmap";
import { add, type Amounts } from "./resources";

/**
 * Tiles that produce for the buildings on their corners. Which tiles fire is up to the game: a dice
 * roll matching a number, an event card naming a terrain, a season track, a player's choice.
 */

/** What a tile gives each building on its corners per building level, or nothing. */
export type TileYield = (tile: string) => Amounts | undefined;

/**
 * Resources each seat gains when `tiles` produce: every building on a producing tile's corners
 * collects that tile's yield times the building's level.
 */
export function produce(map: HexMap, buildings: Buildings, tiles: readonly string[], yieldOf: TileYield, numPlayers: number): Amounts[] {
  const gains: Amounts[] = Array.from({ length: numPlayers }, () => ({}));
  const { tile: byId } = lookup(map);
  for (const id of tiles) {
    const amounts = yieldOf(id);
    if (!amounts) continue;
    for (const corner of byId.get(id)!.corners) {
      const building = buildings[corner];
      if (!building) continue;
      for (let level = 0; level < building.level; level++) gains[building.owner] = add(gains[building.owner], amounts);
    }
  }
  return gains;
}

/** Adds each seat's gains to its pool. */
export const collect = (pools: readonly Amounts[], gains: readonly Amounts[]): Amounts[] => pools.map((pool, seat) => add(pool, gains[seat] ?? {}));

/** What one building on `vertex` would collect if every adjacent tile produced once: a placement heuristic. */
export function cornerYield(map: HexMap, vertex: string, yieldOf: TileYield): Amounts {
  let total: Amounts = {};
  for (const tile of lookup(map).vertex.get(vertex)!.tiles) total = add(total, yieldOf(tile) ?? {});
  return total;
}

/** A shuffled deck of production events (e.g. terrain names); flips one at a time and reshuffles when empty. */
export interface EventDeck<T> {
  drawPile: T[];
  discard: T[];
}

export function flipEvent<T>(rng: Rng, deck: EventDeck<T>): { event: T; deck: EventDeck<T> } {
  const { drawn, drawPile, discard } = draw(rng, deck, 1);
  if (drawn.length === 0) throw new Error("flipEvent: empty event deck");
  return { event: drawn[0], deck: { drawPile, discard: [...discard, drawn[0]] } };
}
