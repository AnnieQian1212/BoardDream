import { Check, ChevronDown, Coins, Heart, Lock, Star, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useEscape } from "../escape";
import {
  BASKET_ODDS,
  buyGolden,
  capacity,
  COMBO_GAP,
  empties,
  FRIENDS,
  give,
  goldenCost,
  goldenFriend,
  MAX_LEVEL,
  ORDER_SLOTS,
  pair,
  place,
  press,
  ready,
  revive,
  reopen,
  serve,
  SPOTS,
  start,
  steam,
  stoveGap,
  STOVE_GAPS,
  THIRD_GUEST,
  tick,
  TOP,
  turnAway,
  unlock,
  unlockCost,
  upgrade,
  upgradeCost,
  type Patch,
  type Upgrade,
} from "../mochi";
import { MochiArt, SteamerBase, SteamerLid } from "./MochiArt";
import { unzoom } from "../zoom";

const KEY = "boarddream.mochi";
const OPEN_KEY = "boarddream.mochi-open";
/** What the town that stood here before kept, cleared once. */
const OLD_KEYS = ["boarddream.hamlet", "boarddream.hamlet-open"];

function load(): Patch {
  try {
    for (const k of OLD_KEYS) localStorage.removeItem(k);
    return reopen(revive(JSON.parse(localStorage.getItem(KEY) ?? "null")));
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

/** Screen height the open strip takes in a window this wide, so the page can leave room for it. */
export const stripHeight = (width: number): number => (width <= 640 ? 196 : 230);

/** Seconds without a move before two alike are pointed out. */
const HINT_AFTER = 9;
/**
 * Seconds without a move after which the steamer stops making batches by itself; it starts again
 * with the next. It also waits for the first move: a game takes minutes to make, and a steamer left
 * running filled the blanket for nobody.
 */
const STEAM_IDLE = 20;

/** How a friend came to sit on its tile, for the way it appears. */
type Arrival = "here" | "steam" | "merge" | "move";

interface Burst {
  id: number;
  spot: number;
  kind: "hearts" | "star" | "puff" | "text";
  text?: string;
}

interface Drag {
  from: number;
  pointer: number;
  x: number;
  y: number;
  el: HTMLElement;
  rects: DOMRect[];
  orders: (DOMRect | null)[];
  moved: boolean;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
/** What a basket of a level brings, in words. */
const basketSays = (level: number) =>
  BASKET_ODDS[level - 1]
    .slice(1)
    .map((chance, k) => `${pct(chance)} ${FRIENDS[k + 1].name.toLowerCase()}`)
    .join(", ");

const inRect = (r: DOMRect | null, x: number, y: number) => !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

/**
 * Something to play while a game is made: a steamer at the foot of the page sets fresh dewdrops on
 * a picnic blanket, and two friends alike, dragged or clicked together, become the next friend up
 * the line, from a dewdrop to the moon. Guests leave order cards asking for friends and pay coins
 * for them; coins open locked tiles and buy a bigger basket, a hotter stove and golden batches.
 * It is kept in this browser between games. With `test`, tools to set it up for trying things out
 * stand above it (the page shows it with ?mochi, no game being made).
 */
export function MochiStrip({ test = false }: { test?: boolean }) {
  const open = useStripOpen();
  const [p, setP] = useState<Patch>(load);
  const current = useRef(p);
  current.current = p;
  const [arrivals, setArrivals] = useState<{ n: number; how: Arrival }[]>(() => Array.from({ length: SPOTS }, () => ({ n: 0, how: "here" })));
  const [held, setHeld] = useState<number>();
  const [dragFrom, setDragFrom] = useState<number>();
  const [over, setOver] = useState<number>();
  const [overOrder, setOverOrder] = useState<number>();
  const [hint, setHint] = useState<[number, number]>();
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [paid, setPaid] = useState<{ id: number; slot: number; coins: number }[]>([]);
  const [news, setNews] = useState<{ id: number; friend?: number }>();
  const [shop, setShop] = useState(false);
  const [batches, setBatches] = useState(0);
  const [shakes, setShakes] = useState(0);
  const [nope, setNope] = useState<{ n: number; spot?: number; slot?: number }>({ n: 0 });
  const [fast, setFast] = useState(false);
  const fastNow = useRef(fast);
  fastNow.current = fast;
  const drag = useRef<Drag | null>(null);
  const dropped = useRef(0);
  const spotEls = useRef<(HTMLButtonElement | null)[]>([]);
  const orderEls = useRef<(HTMLDivElement | null)[]>([]);
  const clock = useRef(0);
  const lastMove = useRef(Date.now());
  /** When the player last did something; the steamer works by itself only while they play. */
  const lastPlay = useRef(0);
  const lastMerge = useRef(0);
  const saved = useRef(p);
  const nextId = useRef(1);
  useEscape(() => {
    setHeld(undefined);
    setShop(false);
  }, held !== undefined || shop);

  // A click anywhere outside the shop closes it.
  useEffect(() => {
    if (!shop) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest(".mochi-shop")) setShop(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [shop]);

  const later = (ms: number, f: () => void) => setTimeout(f, ms);
  const arrive = (spots: number[], how: Arrival) =>
    setArrivals((a) => a.map((x, i) => (spots.includes(i) ? { n: x.n + 1, how } : x)));
  const burst = (spot: number, kind: Burst["kind"], text?: string) => {
    const id = nextId.current++;
    setBursts((b) => [...b, { id, spot, kind, text }]);
    later(1100, () => setBursts((b) => b.filter((x) => x.id !== id)));
  };
  const pay = (slot: number, coins: number) => {
    if (!coins) return;
    const id = nextId.current++;
    setPaid((f) => [...f, { id, slot, coins }]);
    later(1300, () => setPaid((f) => f.filter((x) => x.id !== id)));
  };
  const tell = (friend?: number) => {
    const id = nextId.current++;
    setNews({ id, friend });
    later(3400, () => setNews((n) => (n?.id === id ? undefined : n)));
  };
  const refuse = (where: { spot?: number; slot?: number }) => setNope((n) => ({ n: n.n + 1, ...where }));
  const commit = (next: Patch) => {
    current.current = next;
    setP(next);
  };
  const moved = () => {
    lastMove.current = Date.now();
    lastPlay.current = Date.now();
    setHint(undefined);
  };

  /** A batch from the steamer, by a click or by itself; a click on a full blanket shakes it. */
  const steamOne = (byItself: boolean) => {
    if (!byItself) lastPlay.current = Date.now();
    const { patch, at } = steam(current.current);
    if (at === undefined) {
      if (!byItself) setShakes((s) => s + 1);
      return;
    }
    commit(patch);
    arrive([at], "steam");
    burst(at, "puff");
    setBatches((b) => b + 1);
    clock.current = 0;
  };

  const act = (from: number, to: number) => {
    const chained = Date.now() - lastMerge.current <= COMBO_GAP * 1000;
    const { patch, outcome } = press(current.current, from, to, chained);
    moved();
    if (outcome.kind === "none") return;
    commit(patch);
    if (outcome.kind === "merge" || outcome.kind === "rise") {
      lastMerge.current = Date.now();
      if (outcome.combo > 1) burst(to, "text", `Combo ×${outcome.combo} +${outcome.bonus}`);
    }
    if (outcome.kind === "merge") {
      arrive([to], "merge");
      burst(to, "hearts");
      if (outcome.fresh) tell(outcome.friend);
    } else if (outcome.kind === "rise") {
      burst(to, "star");
      tell();
    } else arrive(outcome.kind === "swap" ? [from, to] : [to], "move");
  };

  /** The friend on `from` handed to the guest in `slot`, who must want one like it. */
  const hand = (from: number, slot: number) => {
    const r = give(current.current, from, slot);
    moved();
    if (!r.gave) return refuse({ slot });
    commit(r.patch);
    burst(from, "hearts");
    pay(slot, r.paid);
  };

  /** A click on a guest's card: the friend picked up goes to the guest, or all it wants that are on the blanket. */
  const onOrder = (slot: number) => {
    if (held !== undefined) {
      hand(held, slot);
      setHeld(undefined);
      return;
    }
    const r = serve(current.current, slot);
    moved();
    if (!r.spots.length) return refuse({ slot });
    commit(r.patch);
    for (const s of r.spots) burst(s, "hearts");
    pay(slot, r.paid);
  };

  const buy = (what: Upgrade | "golden") => {
    if (what === "golden") {
      const { patch, at } = buyGolden(current.current);
      if (at === undefined) return;
      commit(patch);
      arrive([at], "steam");
      burst(at, "puff");
      return;
    }
    commit(upgrade(current.current, what));
  };

  const openTile = (spot: number) => {
    const next = unlock(current.current, spot);
    if (next === current.current) return refuse({ spot });
    commit(next);
    burst(spot, "puff");
  };

  // The steamer makes a batch by itself now and then, guests come to empty places, and a player
  // who has stopped is shown a pair.
  useEffect(() => {
    let beat = 0;
    const timer = setInterval(() => {
      const gap = fastNow.current ? 1 : stoveGap(current.current);
      const playing = Date.now() - lastPlay.current < STEAM_IDLE * 1000;
      if (playing) clock.current = Math.min(gap, clock.current + 0.25);
      if (playing && clock.current >= gap && empties(current.current).length) steamOne(true);
      if (++beat % 2 === 0) {
        const next = tick(current.current, 0.5);
        if (next !== current.current) commit(next);
      }
      if (Date.now() - lastMove.current > HINT_AFTER * 1000 && !drag.current) {
        lastMove.current = Date.now();
        const two = pair(current.current);
        if (two) {
          setHint(two);
          later(2600, () => setHint(undefined));
        }
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // Kept every few seconds when something has changed, and when the page goes.
  useEffect(() => {
    const keep = () => {
      if (saved.current === current.current) return;
      saved.current = current.current;
      save(current.current);
    };
    const timer = setInterval(keep, 3000);
    window.addEventListener("pagehide", keep);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", keep);
      keep();
    };
  }, []);

  if (!open) {
    return (
      <button type="button" className="mochi-tab" onClick={() => setOpen(true)} title="Mochi friends to make while you wait">
        <MochiArt friend={p.best} className="mochi-tab-art" /> Mochi steamer · {p.best + 1}/{FRIENDS.length} friends · <Coins size={13} className="mochi-coin-icon" /> {p.coins.toLocaleString()}
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
    drag.current = {
      from: i,
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      el,
      rects: spotEls.current.map((s) => s!.getBoundingClientRect()),
      orders: orderEls.current.map((o) => o?.getBoundingClientRect() ?? null),
      moved: false,
    };
  };
  const targetAt = (d: Drag, x: number, y: number) => ({ spot: d.rects.findIndex((r) => inRect(r, x, y)), slot: d.orders.findIndex((r) => inRect(r, x, y)) });
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
    d.el.style.transform = `translate(${unzoom(dx)}px, ${unzoom(dy)}px) scale(1.12)`;
    const { spot, slot } = targetAt(d, e.clientX, e.clientY);
    setOver(spot >= 0 && spot !== d.from ? spot : undefined);
    setOverOrder(slot >= 0 && current.current.orders[slot] ? slot : undefined);
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
    setOverOrder(undefined);
    if (cancelled) return;
    const { spot, slot } = targetAt(d, e.clientX, e.clientY);
    if (spot >= 0 && spot !== d.from) act(d.from, spot);
    else if (slot >= 0 && current.current.orders[slot]) hand(d.from, slot);
  };
  /** A click picks a friend up, and a second click sets it down: on one alike, an empty tile, or picks up another. */
  const onClick = (i: number) => {
    if (Date.now() - dropped.current < 300) return;
    if (p.locked[i]) return openTile(i);
    const f = p.spots[i];
    if (held === undefined || held === i) return setHeld(held === i || f === null ? undefined : i);
    if (f !== null && f !== p.spots[held]) return setHeld(i);
    act(held, i);
    setHeld(undefined);
  };

  const full = empties(p).length === 0;
  const moving = dragFrom ?? held;
  const movingFriend = moving === undefined ? undefined : p.spots[moving];
  const tip =
    moving !== undefined
      ? "Drop it on one just like it, on an empty tile, or on a guest's card that asks for it"
      : full
        ? "The blanket is full: merge two alike, or hand friends to the guests"
        : "Merge two alike to meet the next friend. Guests pay coins for the friends on their cards";
  const cap = capacity(p);
  const tileCost = unlockCost(p);

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
                <em>And 200 coins from the guests who watched.</em>
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
        <span className="mochi-badge mochi-friends" title={`${p.best + 1} of ${FRIENDS.length} friends met`}>
          Friends {p.best + 1}/{FRIENDS.length}
        </span>
        <span className="mochi-badge" title="Coins, from the guests">
          <Coins size={13} className="mochi-coin-icon" /> {p.coins.toLocaleString()}
        </span>
        {p.stars > 0 && (
          <span className="mochi-badge dark" title="Moons risen to the sky">
            <Star size={13} className="mochi-star-icon" /> {p.stars}
          </span>
        )}
        <span className="mochi-shop">
          <button type="button" className="mochi-badge mochi-shop-open" onClick={() => setShop(!shop)} aria-expanded={shop}>
            Shop
          </button>
          {shop && <Shop p={p} onBuy={buy} />}
        </span>
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
          <span className="mochi-timer" title={`While you play, the steamer makes one by itself every ${fast ? 1 : stoveGap(p)} s`} aria-hidden>
            <i key={batches} style={{ "--steam": `${fast ? 1 : stoveGap(p)}s` } as CSSProperties} />
          </span>
        </div>
        <div className="mochi-board" aria-label="Picnic blanket">
          {p.spots.map((f, i) => {
            const arrival = arrivals[i];
            const lifted = moving === i;
            const locked = p.locked[i];
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
                  locked && "locked",
                  locked && tileCost !== undefined && p.coins >= tileCost && "affordable",
                  lifted && "lifted",
                  dragFrom === i && "dragged",
                  over === i && !locked && "over",
                  moving !== undefined && moving !== i && f !== null && f === movingFriend && "match",
                  hint?.includes(i) && "hint",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onPointerDown={(e) => onDown(e, i)}
                onPointerMove={onMove}
                onPointerUp={(e) => onUp(e)}
                onPointerCancel={(e) => onUp(e, true)}
                onClick={() => onClick(i)}
                aria-label={locked ? `Locked tile: open it for ${tileCost} coins` : f === null ? "Empty tile" : `${FRIENDS[f].name}${held === i ? ", picked up" : ""}`}
                aria-pressed={f === null ? undefined : held === i}
              >
                {locked && (
                  <span key={nope.spot === i ? nope.n : 0} className={["mochi-lock", nope.spot === i && nope.n > 0 && "shake"].filter(Boolean).join(" ")} aria-hidden>
                    <Lock size={15} />
                    <small>
                      <Coins size={10} /> {tileCost}
                    </small>
                  </span>
                )}
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
                      {b.kind === "text" && <b>{b.text}</b>}
                    </span>
                  ))}
              </button>
            );
          })}
        </div>
        <aside className="mochi-orders" aria-label="Guests' orders">
          {Array.from({ length: ORDER_SLOTS }, (_, s) => {
            if (s >= cap)
              return s === cap ? (
                <div key={s} className="mochi-order later">
                  A third guest comes once you meet the {FRIENDS[THIRD_GUEST].name.toLowerCase()}
                </div>
              ) : null;
            const o = p.orders[s];
            const wanted = movingFriend !== undefined && movingFriend !== null && !!o?.want.some((w, k) => w === movingFriend && !o.got[k]);
            return (
              <div
                key={s}
                className="mochi-order-slot"
                ref={(el) => {
                  orderEls.current[s] = el;
                }}
              >
                {o ? (
                  <div
                    key={nope.slot === s ? nope.n : 0}
                    className={["mochi-order", ready(p, s) && "ready", wanted && "wanted", overOrder === s && "over", nope.slot === s && nope.n > 0 && "shake"].filter(Boolean).join(" ")}
                  >
                    <button
                      type="button"
                      className="mochi-order-main"
                      onClick={() => onOrder(s)}
                      aria-label={`${o.from}: ${o.want.map((w, k) => `${FRIENDS[w].name}${o.got[k] ? " (given)" : ""}`).join(", ")}, pays ${o.coins} coins`}
                      title={held !== undefined ? "Hand the friend you picked up to this guest" : "Hand over the friends this guest wants that are on the blanket"}
                    >
                      <span className="mochi-wants">
                        {o.want.map((w, k) => (
                          <span key={k} className={["mochi-want", o.got[k] && "got"].filter(Boolean).join(" ")}>
                            <MochiArt friend={w} />
                            {o.got[k] && <Check size={13} strokeWidth={3} />}
                          </span>
                        ))}
                      </span>
                      <span className="mochi-order-text">
                        <strong title={o.from}>
                          {o.from.split("'s ")[0]}
                          <span className="mochi-meal">'s {o.from.split("'s ")[1]}</span>
                        </strong>
                        <small>
                          <Coins size={11} className="mochi-coin-icon" /> {o.coins.toLocaleString()}
                        </small>
                      </span>
                    </button>
                    <button type="button" className="quiet icon-only mochi-order-x" onClick={() => (moved(), commit(turnAway(current.current, s)))} aria-label={`Send ${o.from} away`} title="Send this guest away">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="mochi-order waiting">A guest is on the way · {Math.ceil(p.due[s])} s</div>
                )}
                {paid
                  .filter((x) => x.slot === s)
                  .map((x) => (
                    <span key={x.id} className="mochi-paid" aria-hidden>
                      +{x.coins} <Coins size={12} />
                    </span>
                  ))}
              </div>
            );
          })}
        </aside>
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
      {test && (
        <TestTools
          p={p}
          fast={fast}
          onFast={setFast}
          onChange={(next, placed = []) => {
            commit(next);
            if (placed.length) arrive(placed, "steam");
          }}
        />
      )}
    </section>
  );
}

/**
 * Tools for trying the steamer out without playing up to it: coins, any friend on the blanket,
 * friends met, tiles opened, new guests, a fast steamer, and starting over. They change the saved
 * blanket like play does.
 */
function TestTools({ p, fast, onFast, onChange }: { p: Patch; fast: boolean; onFast: (fast: boolean) => void; onChange: (next: Patch, placed?: number[]) => void }) {
  const [shown, setShown] = useState(true);
  const [pick, setPick] = useState(4);
  const [sure, setSure] = useState(false);
  if (!shown)
    return (
      <button type="button" className="mochi-test-open" onClick={() => setShown(true)}>
        Test tools
      </button>
    );
  const add = (times: number) => {
    let next = p;
    const placed: number[] = [];
    for (let k = 0; k < times; k++) {
      const r = place(next, pick);
      if (r.at === undefined) break;
      next = r.patch;
      placed.push(r.at);
    }
    onChange(next, placed);
  };
  const fill = () => {
    const placed = empties(p);
    const spots = p.spots.map((f, i) => (placed.includes(i) ? Math.floor(Math.random() * (Math.min(p.best, 4) + 1)) : f));
    onChange({ ...p, spots }, placed);
  };
  return (
    <div className="mochi-test" role="group" aria-label="Test tools">
      <div className="mochi-test-head">
        <strong>Test tools</strong>
        <button type="button" className="quiet icon-only" onClick={() => setShown(false)} aria-label="Hide the test tools" title="Hide">
          <ChevronDown size={15} />
        </button>
      </div>
      <div className="mochi-test-row">
        <button type="button" onClick={() => onChange({ ...p, coins: p.coins + 100 })}>
          +100 coins
        </button>
        <button type="button" onClick={() => onChange({ ...p, coins: p.coins + 1000 })}>
          +1,000 coins
        </button>
      </div>
      <div className="mochi-test-row">
        <select value={pick} onChange={(e) => setPick(Number(e.target.value))} aria-label="Friend to put on the blanket">
          {FRIENDS.map((f, i) => (
            <option key={f.name} value={i}>
              {f.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => add(1)}>
          Add one
        </button>
        <button type="button" onClick={() => add(2)}>
          Add two
        </button>
      </div>
      <div className="mochi-test-row">
        <button type="button" onClick={fill}>
          Fill the blanket
        </button>
        <button type="button" onClick={() => onChange({ ...p, spots: p.spots.map(() => null) })}>
          Clear it
        </button>
        <button type="button" onClick={() => onChange({ ...p, locked: p.locked.map(() => false) })}>
          Open all tiles
        </button>
      </div>
      <div className="mochi-test-row">
        <button type="button" onClick={() => onChange({ ...p, best: Math.min(TOP, p.best + 1) })} disabled={p.best >= TOP}>
          Meet the next friend
        </button>
        <button type="button" onClick={() => onChange({ ...p, best: TOP })} disabled={p.best >= TOP}>
          Meet them all
        </button>
      </div>
      <div className="mochi-test-row">
        <button type="button" onClick={() => onChange({ ...p, orders: p.orders.map(() => null), due: p.due.map(() => 0) })}>
          New guests now
        </button>
        <label>
          <input type="checkbox" checked={fast} onChange={(e) => onFast(e.target.checked)} /> Steam every second
        </label>
      </div>
      <div className="mochi-test-row">
        <button
          type="button"
          className={sure ? "danger" : undefined}
          onClick={() => {
            if (!sure) return setSure(true);
            setSure(false);
            onChange(start());
          }}
          onBlur={() => setSure(false)}
        >
          {sure ? "Click again to start over" : "Start over"}
        </button>
      </div>
    </div>
  );
}

/** What coins buy: a bigger basket, a hotter stove, golden batches; locked tiles open on the blanket. */
function Shop({ p, onBuy }: { p: Patch; onBuy: (what: Upgrade | "golden") => void }) {
  const items: { what: Upgrade | "golden"; name: string; level?: number; now: string; next?: string; cost?: number; why?: string }[] = [
    {
      what: "basket",
      name: "Bigger basket",
      level: p.basket,
      now: `Batches: ${basketSays(p.basket)}`,
      next: p.basket < MAX_LEVEL ? `Next: ${basketSays(p.basket + 1)}` : undefined,
      cost: upgradeCost(p, "basket"),
    },
    {
      what: "stove",
      name: "Hotter stove",
      level: p.stove,
      now: `Steams one by itself every ${STOVE_GAPS[p.stove - 1]} s`,
      next: p.stove < MAX_LEVEL ? `Next: every ${STOVE_GAPS[p.stove]} s` : undefined,
      cost: upgradeCost(p, "stove"),
    },
    {
      what: "golden",
      name: "Golden batch",
      now: `A ${FRIENDS[goldenFriend(p)].name.toLowerCase()} straight onto the blanket`,
      cost: goldenCost(p),
      why: empties(p).length ? undefined : "No room on the blanket",
    },
  ];
  const tile = unlockCost(p);
  return (
    <div className="mochi-shop-menu" role="menu">
      {items.map((it) => (
        <button key={it.what} type="button" role="menuitem" disabled={it.cost === undefined || p.coins < it.cost || !!it.why} onClick={() => onBuy(it.what)}>
          <span className="mochi-shop-name">
            <strong>{it.name}</strong>
            {it.level !== undefined && (
              <span className="mochi-levels" aria-label={`Level ${it.level} of ${MAX_LEVEL}`}>
                {Array.from({ length: MAX_LEVEL }, (_, k) => (
                  <i key={k} className={k < it.level! ? "on" : undefined} />
                ))}
              </span>
            )}
          </span>
          <small>{it.why ?? it.now}</small>
          {it.next && <small>{it.next}</small>}
          <b>
            {it.cost === undefined ? (
              "Done"
            ) : (
              <>
                <Coins size={12} className="mochi-coin-icon" /> {it.cost.toLocaleString()}
              </>
            )}
          </b>
        </button>
      ))}
      <p>{tile === undefined ? "Every tile of the blanket is open." : `Click a locked tile on the blanket to open it: ${tile} coins.`}</p>
    </div>
  );
}
