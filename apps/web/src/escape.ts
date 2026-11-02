import { useEffect, useRef } from "react";

/**
 * Calls `onClose` when Escape is pressed, for an overlay that is open. The newest overlay to open
 * closes first: each one, on opening, joins a stack, and only the top of it hears the key.
 */
const stack: symbol[] = [];

export function useEscape(onClose: () => void, open = true) {
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    if (!open) return;
    const id = Symbol("overlay");
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || stack.at(-1) !== id) return;
      e.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(id), 1);
    };
  }, [open]);
}
