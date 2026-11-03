import { useSyncExternalStore } from "react";

/**
 * The paintings under way, by game. A painting goes on on the server when the player turns to
 * another game or page, or reloads, so what it has reached is kept here per game rather than in
 * the table's state: a game's Art panel shows its own painting again when the game comes back,
 * and never another game's.
 */
export interface Underway {
  /** The board's step, as the panel shows it ("Painting the board…"). */
  board?: string;
  /** Cards painted so far, of those this painting set out to paint. */
  cards?: { done: number; total: number };
  /** Why the last board painting was not kept. */
  boardError?: string;
}

const NONE: Underway = {};
const underway = new Map<string, Underway>();
const listeners = new Set<() => void>();

export const paintingsOf = (game: string): Underway => underway.get(game) ?? NONE;

/** Records what a game's paintings have reached; a field set to undefined is over. */
export function updatePaintings(game: string, change: Underway) {
  const next = { ...paintingsOf(game), ...change };
  for (const key of Object.keys(next) as (keyof Underway)[]) if (next[key] === undefined) delete next[key];
  if (Object.keys(next).length === 0) underway.delete(game);
  else underway.set(game, next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** A game's paintings under way, kept current. */
export const usePaintings = (game: string): Underway => useSyncExternalStore(subscribe, () => paintingsOf(game));

/** "painting the board" as the panel shows a step: "Painting the board…". */
export const stepLabel = (step: string) => `${step.charAt(0).toUpperCase()}${step.slice(1)}…`;
