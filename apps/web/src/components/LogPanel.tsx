import { ScrollText } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { playerColor } from "../colors";

export interface LogEntry {
  id: number;
  seat: number;
  text: string;
  /** What the player said while making the move (Muse Spark opponents). */
  say?: string;
}

/** How many moves the log shows, newest first. */
const SHOWN = 30;

/**
 * The moves so far, from the turn bar: what the bots just did, who voted for whom, what was said.
 * It is part of playing, so it sits beside Hint on the table rather than in the designer's drawer,
 * and it opens whoever's turn it is. A click outside or Escape closes it.
 */
export function MoveLog({ entries, human, names }: { entries: LogEntry[]; human: number; names?: (string | undefined)[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const who = (seat: number) => (seat === human ? "You" : (names?.[seat] ?? `P${seat + 1}`));
  return (
    <div className="move-log" ref={box}>
      <button type="button" className="quiet hint-button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ScrollText size={15} /> Log
      </button>
      {open && (
        <div className="move-log-pop" role="dialog" aria-label="Game log">
          {entries.length === 0 ? (
            <p className="hint">Moves will show up here.</p>
          ) : (
            <ol className="log">
              {entries
                .slice(-SHOWN)
                .reverse()
                .map((entry) => (
                  <li key={entry.id} style={{ "--seat": playerColor(entry.seat) } as CSSProperties}>
                    <span className="seat-dot" />
                    <span>
                      <b>{who(entry.seat)}</b> {entry.text}
                      {entry.say && <q className="log-say">{entry.say}</q>}
                    </span>
                  </li>
                ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
