import { useSyncExternalStore } from "react";

/**
 * Generated games a player has starred, kept in this browser like the games it hides: no account
 * needed, and it works on the static demo too. Other tabs follow through the storage event.
 */

const KEY = "boarddream.favorites";
let cache: ReadonlySet<string> | undefined;
const listeners = new Set<() => void>();

function read(): ReadonlySet<string> {
  if (cache) return cache;
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    cache = new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []);
  } catch {
    // Storage can be unavailable (private windows, blocked site data): no favorites then.
    cache = new Set();
  }
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cache = undefined;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Stars a game, or takes its star away. */
export function toggleFavorite(id: string): void {
  const next = new Set(read());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // Kept for this visit only.
  }
  for (const listener of listeners) listener();
}

/** The starred games' ids, updated as stars change in this tab or another. */
export function useFavorites(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, read);
}
