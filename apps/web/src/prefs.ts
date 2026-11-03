import { useSyncExternalStore } from "react";

/**
 * A player's table preferences, kept in this browser: whether what can be clicked glows (a practised
 * player may want the board in its own colors; the clickable spots still light up under the pointer)
 * and whether battles play out on the board (the dice, the hits, pieces knocked off) or are skipped.
 */
export interface Prefs {
  /** What can be clicked glows teal: tiles, cards, piles and chips. */
  hints: boolean;
  /** A battle plays out on the board before the next move. */
  battles: boolean;
  /** The language the rules card explains a game in (translation.ts); the table stays in English. */
  language: "en" | "zh";
}

const KEY = "boarddream.prefs";
const DEFAULTS: Prefs = { hints: true, battles: true, language: "en" };
const listeners = new Set<() => void>();

function read(): Prefs {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>;
    return {
      hints: typeof stored.hints === "boolean" ? stored.hints : DEFAULTS.hints,
      battles: typeof stored.battles === "boolean" ? stored.battles : DEFAULTS.battles,
      language: stored.language === "zh" ? "zh" : "en",
    };
  } catch {
    return DEFAULTS;
  }
}

let current: Prefs = typeof window === "undefined" ? DEFAULTS : read();

/** The page's root carries `quiet-hints` while hints are off, so the stylesheet drops its glows too. */
function apply() {
  if (typeof document !== "undefined") document.documentElement.classList.toggle("quiet-hints", !current.hints);
}
apply();

/** The preferences now, for code outside React (a frame loop, a timer). */
export const prefs = (): Prefs => current;

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  current = { ...current, [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Kept for this page only.
  }
  apply();
  for (const listener of listeners) listener();
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => DEFAULTS,
  );
}
