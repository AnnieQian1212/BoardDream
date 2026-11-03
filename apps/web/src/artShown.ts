/**
 * Which of a game's paintings the table shows: its card art and its painted board. Both show by
 * default; the player can hide either from the Art panel (to play on the plain storybook board, or
 * with plain cards), per game, remembered in this browser. The print kit starts from the same choice.
 */
export interface ArtShown {
  cards: boolean;
  board: boolean;
}

const KEY = "boarddream.art-shown";

function readAll(): Record<string, Partial<ArtShown>> {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown;
    return stored && typeof stored === "object" ? (stored as Record<string, Partial<ArtShown>>) : {};
  } catch {
    return {};
  }
}

/** What the table shows of a game's art. */
export function artShown(gameId: string): ArtShown {
  const stored = readAll()[gameId] ?? {};
  return { cards: stored.cards !== false, board: stored.board !== false };
}

/** Shows or hides one part of a game's art, and returns what is shown now (kept for this page if the browser will not store it). */
export function setArtShown(gameId: string, part: keyof ArtShown, on: boolean): ArtShown {
  const next = { ...artShown(gameId), [part]: on };
  const all = readAll();
  // Only a game with something hidden is stored.
  if (next.cards && next.board) delete all[gameId];
  else all[gameId] = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Kept for this page only.
  }
  return next;
}
