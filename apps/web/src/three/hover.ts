import type { CardView } from "@boarddream/engine";
import { useSyncExternalStore } from "react";

/** What the pointer is over, for the magnified card preview. Kept outside React state so hovering never re-renders the scene. */
export type Hover = { card: CardView; x: number; y: number } | { text: string; x: number; y: number } | null;

let current: Hover = null;
const listeners = new Set<() => void>();

export function setHover(next: Hover) {
  current = next;
  for (const listener of listeners) listener();
}

export function useHover(): Hover {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

export function setCursor(pointer: boolean) {
  document.body.style.cursor = pointer ? "pointer" : "";
}
