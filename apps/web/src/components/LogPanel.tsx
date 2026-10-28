import { ScrollText } from "lucide-react";
import type { CSSProperties } from "react";
import { playerColor } from "../colors";

export interface LogEntry {
  id: number;
  seat: number;
  text: string;
  /** What the player said while making the move (Muse Spark opponents). */
  say?: string;
}

export function LogPanel({ entries, human }: { entries: LogEntry[]; human: number }) {
  return (
    <section className="panel">
      <h2>
        <ScrollText size={17} /> Game log
      </h2>
      {entries.length === 0 ? (
        <p className="hint">Moves will show up here.</p>
      ) : (
        <ol className="log">
          {entries
            .slice(-8)
            .reverse()
            .map((entry) => (
              <li key={entry.id} style={{ "--seat": playerColor(entry.seat) } as CSSProperties}>
                <span className="seat-dot" />
                <b>{entry.seat === human ? "You" : `P${entry.seat + 1}`}</b> {entry.text}
                {entry.say && <q className="log-say">{entry.say}</q>}
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}
