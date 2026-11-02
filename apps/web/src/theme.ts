import { useSyncExternalStore } from "react";

/**
 * Light or dark pages. The theme follows the system until the player picks one, which this browser
 * then keeps. index.html sets it before the first paint, so a dark page never flashes light.
 */

export type Theme = "light" | "dark";

const KEY = "boarddream.theme";
const listeners = new Set<() => void>();
const media = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : undefined;

function chosen(): Theme | undefined {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    return undefined;
  }
}

const current = (): Theme => chosen() ?? (media?.matches ? "dark" : "light");

function apply() {
  document.documentElement.dataset.theme = current();
  for (const listener of listeners) listener();
}

media?.addEventListener?.("change", () => {
  if (!chosen()) apply();
});

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Kept for this visit only.
  }
  document.documentElement.dataset.theme = theme;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => event.key === KEY && apply();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The page's theme, updated when the player or the system changes it. */
export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => "light",
  );
}
