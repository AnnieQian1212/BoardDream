import { ChevronDown, Heart, Star } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useEscape } from "../escape";
import { AUTO_STEAM, empties, FRIENDS, pair, press, revive, SPOTS, start, steam, TOP, type Patch } from "../mochi";
import { MochiArt, SteamerBase, SteamerLid } from "./MochiArt";

const KEY = "boarddream.mochi";
const OPEN_KEY = "boarddream.mochi-open";
/** What the town that stood here before kept, cleared once. */
const OLD_KEYS = ["boarddream.hamlet", "boarddream.hamlet-open"];

function load(): Patch {
  try {
    for (const k of OLD_KEYS) localStorage.removeItem(k);
    return revive(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return start();
  }
}

function save(p: Patch) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Kept for this visit only.
  }
}

// Whether the strip is open or folded to a tab: the page leaves room for it while open.
const openListeners = new Set<() => void>();
let openNow = (() => {
  try {
    return typeof window === "undefined" || localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
})();
function setOpen(open: boolean) {
  openNow = open;
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    // Not remembered.
  }
  for (const l of openListeners) l();
}

/** Whether the mochi strip is open (rather than folded to a tab). */
export function useStripOpen(): boolean {
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
export const STRIP_HEIGHT = 200;

/** Seconds without a move before two alike are pointed out. */
const HINT_AFTER = 9;

/** How a friend came to sit on its spot, for the way it appears. */
type Arrival = "here" | "steam" | "merge" | "move";

interface Burst {
  id: number;
  spot: number;
  kind: "hearts" | "star" | "puff";
}

interface Drag {
  from: number;
  pointer: number;
  x: number;
  y: number;
  el: HTMLElement;
  rects: DOMRect[];
  moved: boolean;
}

/**
 * Something to play while a game is made: a steamer at the foot of the page sets fresh dewdrops on
 * a picnic blanket, and two friends alike, dragged or clicked together, become the next friend up
 * the line, from a dewdrop to the moon. It is kept in this browser between games.
 */
export function MochiStrip() {
  const open = useStripOpen();
  const [p, setP] = useState<Patch>(load);
  const current = useRef(p);
  current.current = p;
  const [arrivals, setArrivals] = useState<{ n: number; how: Arrival }[]>(() => Array.from({ length: SPOTS }, () => ({ n: 0, how: "here" })));
  const [held, setHeld] = useState<number>();
  const [dragFrom, setDragFrom] = useState<number>();
  const [over, setOver] = useState<number>();
  const [hint, setHint] = useState<[number, number]>();
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [news, setNews] = useState<{ id: number; friend?: number }>();
  const [batches, setBatches] = useState(0);
  const [shakes, setShakes] = useState(0);
  const drag = useRef<Drag | null>(null);
  const dropped = useRef(0);
  const spotEls = useRef<(HTMLButtonElement | null)[]>([]);
  const clock = useRef(0);
  const lastMove = useRef(Date.now());
  const nextId = useRef(1);
  useEscape(() => setHeld(undefined), held !== undefined);

  const arrive = (spots: number[], how: Arrival) =>
    setArrivals((a) => a.map((x, i) => (spots.includes(i) ? { n: x.n + 1, how } : x)));
  const burst = (spot: number, kind: Burst["kind"]) => {
    const id = nextId.current++;
    setBursts((b) => [...b, { id, spot, kind }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1100);
  };
  const tell = (friend?: number) => {
    const id = nextId.current++;
    setNews({ id, friend });
    setTimeout(() => setNews((n) => (n?.id === id ? undefined : n)), 3400);
  };
  const commit = (next: Patch) => {
    current.current = next;
    setP(next);
  };

  /** A batch from the steamer, by a click or by itself; a click on a full blanket shakes it. */
  const steamOne = (byItself: boolean) => {
    const { patch, at } = steam(current.current);
    if (at === undefined) {
      if (!byItself) setShakes((s) => s + 1);
      return false;
    }
    commit(patch);
    arrive([at], "steam");
    burst(at, "puff");
    setBatches((b) => b + 1);
    clock.current = 0;
    return true;
  };

  const act = (from: number, to: number) => {
    const { patch, outcome } = press(current.current, from, to);
    lastMove.current = Date.now();
    setHint(undefined);
    if (outcome.kind === "none") return;
    commit(patch);
    if (outcome.kind === "merge") {
      arrive([to], "merge");
      burst(to, "hearts");
      if (outcome.fresh) tell(outcome.friend);
    } else if (outcome.kind === "rise") {
      burst(to, "star");
      tell();
    } else arrive(outcome.kind === "swap" ? [from, to] : [to], "move");
  };

  // The steamer makes a batch by itself now and then, and a player who has stopped is shown a pair.
  useEffect(() => {
    const timer = setInterval(() => {
      clock.current = Math.min(AUTO_STEAM, clock.current + 0.25);
      if (clock.current >= AUTO_STEAM && empties(current.current).length) steamOne(true);
      if (Date.now() - lastMove.current > HINT_AFTER * 1000 && !drag.current) {
        lastMove.current = Date.now();
        const two = pair(current.current);
        if (two) {
          setHint(two);
          setTimeout(() => setHint(undefined), 2600);
        }
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => save(p), 400);
    return () => clearTimeout(timer);
  }, [p]);
  useEffect(() => {
    const keep = () => save(current.current);
    window.addEventListener("pagehide", keep);
    return () => {
      window.removeEventListener("pagehide", keep);
      keep();
    };
  }, []);

  if (!open) {
    return (
      <button type="button" className="mochi-tab" onClick={() => setOpen(true)} title="Mochi friends to make while you wait">
        <MochiArt friend={p.best} className="mochi-tab-art" /> Mochi steamer · {p.best + 1}/{FRIENDS.length} friends
        {p.stars > 0 && (
          <>
            {" "}
            · <Star size={13} className="mochi-star-icon" /> {p.stars}
          </>
        )}
      </button>
    );
  }

  const onDown = (e: ReactPointerEvent<HTMLButtonElement>, i: number) => {
    if (e.button !== 0 || p.spots[i] === null) return;
    const el = e.currentTarget.querySelector<HTMLElement>(".mochi-lift");
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { from: i, pointer: e.pointerId, x: e.clientX, y: e.clientY, el, rects: spotEls.current.map((s) => s!.getBoundingClientRect()), moved: false };
  };
  const spotAt = (d: Drag, x: number, y: number) => d.rects.findIndex((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      d.moved = true;
      setHeld(undefined);
      setHint(undefined);
      setDragFrom(d.from);
    }
    d.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`;
    const at = spotAt(d, e.clientX, e.clientY);
    setOver(at >= 0 && at !== d.from ? at : undefined);
  };
  const onUp = (e: ReactPointerEvent, cancelled = false) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    drag.current = null;
    if (!d.moved) return;
    dropped.current = Date.now();
    d.el.style.transform = "";
    setDragFrom(undefined);
    setOver(undefined);
    const to = spotAt(d, e.clientX, e.clientY);
    if (!cancelled && to >= 0 && to !== d.from) act(d.from, to);
  };
  /** A click picks a friend up, and a second click sets it down: on one alike, an empty spot, or picks up another. */
  const onClick = (i: number) => {
    if (Date.now() - dropped.current < 300) return;
    const f = p.spots[i];
    if (held === undefined || held === i) return setHeld(held === i || f === null ? undefined : i);
    if (f !== null && f !== p.spots[held]) return setHeld(i);
    act(held, i);
    setHeld(undefined);
  };

  const full = empties(p).length === 0;
  const moving = dragFrom ?? held;
  const tip = full ? "The blanket is full: put two alike together to make room" : "Drag a friend onto one just like it, or click them both";

  return (
    <section className="mochi" aria-label="Mochi friends to make while your game is made">
      {news && (
        <div key={news.id} className="mochi-news" role="status">
          {news.friend === undefined ? (
            <>
              <Star size={34} className="mochi-star-icon" />
              <span>
                <small>Two moons rose</small>
                <strong>A new star in the sky</strong>
              </span>
            </>
          ) : (
            <>
              <MochiArt friend={news.friend} mood="happy" className="mochi-news-art" />
              <span>
                <small>New friend!</small>
                <strong>{FRIENDS[news.friend].name}</strong>
                <em>{FRIENDS[news.friend].note}</em>
              </span>
            </>
          )}
        </div>
      )}
      <header className="mochi-head">
        <strong>Mochi steamer</strong>
        <span className="mochi-chip" title={`${p.best + 1} of ${FRIENDS.length} friends met`}>
          <Heart size={12} className="mochi-heart-icon" /> {p.best + 1}/{FRIENDS.length} friends
        </span>
        {p.stars > 0 && (
          <span className="mochi-chip" title="Moons risen to the sky">
            <Star size={13} className="mochi-star-icon" /> {p.stars}
          </span>
        )}
        <span className="mochi-tip">{tip}</span>
        <span className="mochi-gap" />
        <button type="button" className="quiet icon-only" onClick={() => setOpen(false)} aria-label="Fold the steamer away" title="Fold away">
          <ChevronDown size={16} />
        </button>
      </header>
      <div className="mochi-body">
        <div className="mochi-stove">
          <button type="button" className={["mochi-steamer", full && "full"].filter(Boolean).join(" ")} onClick={() => steamOne(false)} aria-label="Steam a new friend" title={full ? "No room on the blanket" : "Steam a new friend"}>
            <span className="mochi-steam" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span key={`lid${batches}`} className={["mochi-lid", batches > 0 && "hop"].filter(Boolean).join(" ")}>
              <SteamerLid />
            </span>
            <span key={`base${shakes}`} className={["mochi-basket", shakes > 0 && "shake"].filter(Boolean).join(" ")}>
              <SteamerBase />
            </span>
          </button>
          <span className="mochi-timer" title="The steamer makes one by itself every few seconds" aria-hidden>
            <i key={batches} style={{ "--steam": `${AUTO_STEAM}s` } as CSSProperties} />
          </span>
        </div>
        <div className="mochi-board" aria-label="Picnic blanket">
          {p.spots.map((f, i) => {
            const arrival = arrivals[i];
            const lifted = moving === i;
            return (
              <button
                key={i}
                ref={(el) => {
                  spotEls.current[i] = el;
                }}
                type="button"
                className={[
                  "mochi-spot",
                  f !== null && "taken",
                  lifted && "lifted",
                  dragFrom === i && "dragged",
                  over === i && "over",
                  moving !== undefined && moving !== i && f !== null && f === p.spots[moving] && "match",
                  hint?.includes(i) && "hint",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onPointerDown={(e) => onDown(e, i)}
                onPointerMove={onMove}
                onPointerUp={(e) => onUp(e)}
                onPointerCancel={(e) => onUp(e, true)}
                onClick={() => onClick(i)}
                aria-label={f === null ? "Empty spot" : `${FRIENDS[f].name}${held === i ? ", picked up" : ""}`}
                aria-pressed={f === null ? undefined : held === i}
              >
                {f !== null && (
                  <span className="mochi-lift" style={{ "--f": f } as CSSProperties}>
                    <span key={arrival.n} className={`mochi-friend ${arrival.how}`} style={{ "--delay": `${-((i * 0.37) % 2.8)}s` } as CSSProperties}>
                      <MochiArt friend={f} mood={lifted ? "happy" : "idle"} />
                    </span>
                  </span>
                )}
                {bursts
                  .filter((b) => b.spot === i)
                  .map((b) => (
                    <span key={b.id} className={`mochi-burst ${b.kind}`} aria-hidden>
                      {b.kind === "hearts" && [0, 1, 2, 3].map((k) => <Heart key={k} size={14} style={{ "--k": k } as CSSProperties} />)}
                      {b.kind === "star" && <Star size={30} />}
                      {b.kind === "puff" && [0, 1, 2].map((k) => <i key={k} style={{ "--k": k } as CSSProperties} />)}
                    </span>
                  ))}
              </button>
            );
          })}
        </div>
        <aside className="mochi-shelf" aria-label="Friends met">
          <h3>Friends met</h3>
          <div className="mochi-shelf-grid">
            {FRIENDS.map((friend, f) =>
              f <= p.best ? (
                <span key={f} className="mochi-met" title={`${friend.name}: ${friend.note}`}>
                  <MochiArt friend={f} />
                </span>
              ) : (
                <span key={f} className="mochi-met unknown" title={f === p.best + 1 ? "Put two alike together to meet the next friend" : "Not met yet"}>
                  ?
                </span>
              ),
            )}
          </div>
          <p className="mochi-shelf-note">{p.best >= TOP ? "Two moons together rise to the sky as a star." : `Next: put two ${FRIENDS[p.best].many} together.`}</p>
        </aside>
      </div>
    </section>
  );
}
