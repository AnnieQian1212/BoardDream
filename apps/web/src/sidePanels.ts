import { useCallback, useState } from "react";

/** Which side panels are open: the create panel on the left, tuning and stats on the right. */
export interface SidePanels {
  left: boolean;
  right: boolean;
}

const KEY = "boarddream:side-panels";

/**
 * The side panels' state, remembered in this browser when the viewer folds or opens one. Storage
 * can be unavailable (private windows, previews): then both start open. `start` false (a narrow
 * window, a self-playing demo) starts both folded without touching what is remembered.
 */
export function useSidePanels(start: boolean) {
  const [open, setOpen] = useState<SidePanels>(() => {
    if (!start) return { left: false, right: false };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<SidePanels> | null;
      if (typeof saved?.left === "boolean" && typeof saved.right === "boolean") return { left: saved.left, right: saved.right };
    } catch {
      // Unreadable: start open.
    }
    return { left: true, right: true };
  });
  const change = useCallback((next: (current: SidePanels) => SidePanels) => {
    setOpen((current) => {
      const value = next(current);
      try {
        localStorage.setItem(KEY, JSON.stringify(value));
      } catch {
        // Not remembered; the panels still fold for this visit.
      }
      return value;
    });
  }, []);
  /** Folds or opens one side. */
  const toggle = useCallback((side: keyof SidePanels) => change((current) => ({ ...current, [side]: !current[side] })), [change]);
  /** Folds both sides if either is open, else opens both. */
  const toggleBoth = useCallback(() => change((current) => (current.left || current.right ? { left: false, right: false } : { left: true, right: true })), [change]);
  return { open, toggle, toggleBoth };
}
