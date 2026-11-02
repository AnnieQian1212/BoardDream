import { ChevronDown, Grid3x3 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { bonusOf, buy, CELLS, COLS, costOf, emptyCells, fresh, lay, patch, picture, revive, UPGRADES, type Mosaic, type Upgrade } from "../mosaic";

const KEY = "boarddream.mosaic";
const OPEN_KEY = "boarddream.mosaic-open";

function load(): Mosaic {
  try {
    return revive(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return fresh();
  }
}

function save(m: Mosaic) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // Kept for this visit only.
  }
}

// Whether the mosaic is open or folded to a tab: the page leaves room for it while open.
const openListeners = new Set<() => void>();
const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
};
let openNow = typeof window !== "undefined" ? readOpen() : true;
function setOpen(open: boolean) {
  openNow = open;
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    // Not remembered.
  }
  for (const l of openListeners) l();
}

/** Whether the mosaic strip is open (rather than folded to a tab). */
export function useMosaicOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      openListeners.add(l);
      return () => openListeners.delete(l);
    },
    () => openNow,
    () => true,
  );
}

/** Screen height the open strip takes, so the page can leave room for it. */
export const MOSAIC_HEIGHT = 178;

/**
 * Something to tap while a game is made: lay the tiles of a mosaic, a patch per click (or drag),
 * earn tesserae, and spend them on a wider trowel, apprentices who lay tiles on their own, and
 * gilded glass. Progress is kept in this browser, so it carries on next time.
 */
export function MosaicGame() {
  const open = useMosaicOpen();
  const [m, setM] = useState<Mosaic>(load);
  const current = useRef(m);
  current.current = m;
  // Tiles just laid, which pop as they land.
  const [recent, setRecent] = useState<Set<number>>(new Set());
  const [note, setNote] = useState<string>();
  const painting = useRef(false);
  const { name, colors } = picture(m.level);

  // Reads and writes through the ref: apprentices call it from a timer set up renders ago.
  const apply = (cells: number[]) => {
    const before = current.current;
    const result = lay(before, cells);
    if (result.laid === 0) return;
    current.current = result.mosaic;
    setM(result.mosaic);
    if (result.finished) {
      setRecent(new Set());
      setNote(`${picture(before.level).name} finished! +${bonusOf(before.level)} tesserae`);
      return;
    }
    const laid = new Set(cells);
    setRecent((old) => new Set([...old, ...laid]));
    setTimeout(() => setRecent((old) => new Set([...old].filter((c) => !laid.has(c)))), 450);
  };

  // Apprentices lay a tile each, every second.
  useEffect(() => {
    if (m.apprentices === 0) return;
    const timer = setInterval(() => apply(emptyCells(current.current, current.current.apprentices)), 1000);
    return () => clearInterval(timer);
  }, [m.apprentices, m.level]);

  useEffect(() => {
    const timer = setTimeout(() => save(m), 400);
    return () => clearTimeout(timer);
  }, [m]);

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(undefined), 2600);
    return () => clearTimeout(timer);
  }, [note]);

  const cellOf = (e: PointerEvent) => Number((e.target as HTMLElement).dataset.cell ?? NaN);
  const down = (e: PointerEvent<HTMLDivElement>) => {
    const cell = cellOf(e);
    if (!Number.isFinite(cell)) return;
    painting.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
    apply(patch(cell, current.current.trowel));
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!painting.current) return;
    // Under pointer capture the target is the wall: find the cell under the pointer.
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const cell = Number(el?.dataset.cell ?? NaN);
    if (Number.isFinite(cell)) apply(patch(cell, current.current.trowel));
  };
  const up = () => (painting.current = false);

  if (!open) {
    return (
      <button type="button" className="mosaic-tab" onClick={() => setOpen(true)} title="A mosaic to tap while you wait">
        <Grid3x3 size={15} /> Mosaic · {m.chips.toLocaleString()} tesserae
      </button>
    );
  }

  const done = m.laid.filter(Boolean).length;
  return (
    <section className="mosaic" aria-label="Mosaic: tap or drag to lay tiles while your game is made">
      <header className="mosaic-head">
        <strong>
          Mosaic {m.level + 1} · {name}
        </strong>
        <span className="mosaic-progress">
          {done} / {CELLS}
        </span>
        <span className="mosaic-chips">{m.chips.toLocaleString()} tesserae</span>
        <span className="mosaic-gap" />
        {UPGRADES.map((u) => {
          const cost = costOf(m, u.id);
          return (
            <button
              key={u.id}
              type="button"
              className="ghost mosaic-buy"
              disabled={cost === undefined || m.chips < cost}
              onClick={() => {
                current.current = buy(current.current, u.id as Upgrade);
                setM(current.current);
              }}
              title={`${u.name}: ${u.does}`}
            >
              {u.name} {m[u.id] > 0 && <small>×{m[u.id]}</small>}
              <b>{cost === undefined ? "max" : cost.toLocaleString()}</b>
            </button>
          );
        })}
        <button type="button" className="quiet icon-only" onClick={() => setOpen(false)} aria-label="Fold the mosaic away" title="Fold away">
          <ChevronDown size={16} />
        </button>
      </header>
      <div
        className="mosaic-wall"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key !== " " && e.key !== "Enter") return;
          e.preventDefault();
          const [cell] = emptyCells(current.current, 1);
          if (cell !== undefined) apply(patch(cell, current.current.trowel));
        }}
      >
        {colors.map((color, i) => (
          <i key={i} data-cell={i} className={[m.laid[i] && "on", recent.has(i) && "new"].filter(Boolean).join(" ")} style={{ "--c": color } as CSSProperties} />
        ))}
        {note && (
          <div className="mosaic-note">
            <span>{note}</span>
          </div>
        )}
      </div>
    </section>
  );
}
