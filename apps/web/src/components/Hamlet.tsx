import { Apple, Beer, ChevronDown, ChevronsUp, Coins, Croissant, Droplet, Flower2, Home, MoreHorizontal, Star, Wheat, X, type LucideProps } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useEscape } from "../escape";
import {
  boosted,
  build,
  building,
  BUILDINGS,
  canRaise,
  capacity,
  catchUp,
  clearCost,
  clearWild,
  costOf,
  deliver,
  demolish,
  eraIndex,
  ERAS,
  eraOf,
  GOODS,
  isCrop,
  isWorkshop,
  levelOf,
  MAX_LEVEL,
  nextEra,
  priceOf,
  promised,
  raise,
  raiseCost,
  RECIPES,
  revive,
  sell,
  SLOTS,
  spareOf,
  start,
  tap,
  tick,
  turnAway,
  villagers,
  type Good,
  type Kind,
  type Made,
  type Plot,
  type Village,
} from "../village";

const KEY = "boarddream.hamlet";
const OPEN_KEY = "boarddream.hamlet-open";

/** The saved village, caught up for the time the page was away (capped in village.ts). */
function load(): Village {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { village?: unknown; at?: number } | null;
    const village = revive(saved?.village);
    return saved?.at ? catchUp(village, (Date.now() - saved.at) / 1000) : village;
  } catch {
    return start();
  }
}

function save(village: Village) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ village, at: Date.now() }));
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

/** Whether the hamlet strip is open (rather than folded to a tab). */
export function useHamletOpen(): boolean {
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
export const HAMLET_HEIGHT = 200;

/** What each stage of the town opens up, said once when the town reaches it. */
const GROWN = [
  "",
  "Now a village: orchards and windmills to build, and a second cart at the gate.",
  "Now a market town: bakeries, cider presses and trading posts to build.",
  "Now a trade town: carts come with bigger, mixed orders.",
];

interface Float {
  id: number;
  plot: number;
  good?: Good;
  text: string;
}

/** A sack of flour, drawn like the other line icons. */
function FlourIcon({ size = 24, ...rest }: LucideProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d="M9 3h6l-1.2 3.4C17 8.2 19 11.4 19 15a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5c0-3.6 2-6.8 5.2-8.6z" />
      <path d="M9.5 6.5h5" />
      <path d="M10 13.5c1.2.8 2.8.8 4 0" />
    </svg>
  );
}

const GOOD_ICON: Record<Good, (p: LucideProps) => ReactNode> = {
  wheat: (p) => <Wheat {...p} />,
  apples: (p) => <Apple {...p} />,
  flour: (p) => <FlourIcon {...p} />,
  bread: (p) => <Croissant {...p} />,
  cider: (p) => <Beer {...p} />,
};
const goodName = (g: Good) => GOODS.find((x) => x.good === g)!.name.toLowerCase();

function GoodIcon({ good, size = 14 }: { good: Good; size?: number }) {
  return <span className={`good-icon ${good}`}>{GOOD_ICON[good]({ size, "aria-hidden": true })}</span>;
}

/**
 * Something to tend while a game is made: a strip of land at the foot of the page that grows from
 * a hamlet into a trade town. Click ripe crops to harvest them (or green ones to tend them), build
 * on open land, clear the wild, and fill the orders of the carts from neighboring villages to earn
 * coins and stars. It is kept in this browser and keeps working, for a while, between games.
 */
export function Hamlet() {
  const open = useHamletOpen();
  const [v, setV] = useState<Village>(load);
  const current = useRef(v);
  current.current = v;
  const [menu, setMenu] = useState<number>();
  const [market, setMarket] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [news, setNews] = useState<string>();
  const nextFloat = useRef(0);
  const era = useRef(eraIndex(v));
  useEscape(() => {
    setMenu(undefined);
    setMarket(false);
  }, menu !== undefined || market);

  // A click anywhere outside a menu closes it.
  useEffect(() => {
    if (menu === undefined && !market) return;
    const close = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest(".hamlet-menu, .hamlet-spot, .hamlet-more, .hamlet-market")) return;
      setMenu(undefined);
      setMarket(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu, market]);

  const float = (plot: number, text: string, good?: Good) => {
    const id = nextFloat.current++;
    setFloats((f) => [...f, { id, plot, text, good }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1200);
  };
  const commit = (next: Village) => {
    current.current = next;
    setV(next);
    const grown = eraIndex(next);
    if (grown > era.current) {
      setNews(GROWN[grown]);
      setTimeout(() => setNews(undefined), 7000);
    }
    era.current = grown;
  };
  const showMade = (made: Made[]) => {
    for (const m of made) float(m.plot, `+${m.n}`, m.good);
  };

  // A quarter second at a time: crops grow, villagers bring them in, workshops work, carts come.
  useEffect(() => {
    const timer = setInterval(() => {
      const { village, made } = tick(current.current, 0.25);
      commit(village);
      showMade(made);
    }, 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => save(v), 500);
    return () => clearTimeout(timer);
  }, [v]);
  useEffect(() => () => save(current.current), []);

  if (!open) {
    return (
      <button type="button" className="hamlet-tab" onClick={() => setOpen(true)} title="A town to tend while you wait">
        <Home size={15} /> {eraOf(v)} · <Star size={13} className="star-icon" /> {v.stars} · {Math.floor(v.coins).toLocaleString()} coins
      </button>
    );
  }

  const tapPlot = (plot: number) => {
    const p = v.plots[plot];
    setMarket(false);
    if (!isCrop(p)) return setMenu(menu === plot ? undefined : plot);
    setMenu(undefined);
    const { village, made } = tap(current.current, plot);
    commit(village);
    if (made) showMade([made]);
    else float(plot, "tended");
  };
  const next = nextEra(v);
  const shown = GOODS.filter((g) => g.era <= eraIndex(v) || v.stock[g.good] > 0);
  const kept = promised(v);
  const people = Math.min(10, villagers(v));
  const slots = Array.from({ length: SLOTS }, (_, s) => s);

  return (
    <section className="hamlet" aria-label="A town to tend while your game is made">
      <header className="hamlet-head">
        <strong>{eraOf(v)}</strong>
        <span className="hamlet-stars" title={next ? `${next.stars - v.stars} more stars to grow into a ${next.name.toLowerCase()}` : "The town is grown"}>
          <Star size={13} className="star-icon" /> {v.stars}
          {next && (
            <>
              <span className="hamlet-meter" aria-hidden>
                <i style={{ width: `${Math.min(100, ((v.stars - ERAS[eraIndex(v)].stars) / (next.stars - ERAS[eraIndex(v)].stars)) * 100)}%` }} />
              </span>
              <small>{next.name}</small>
            </>
          )}
        </span>
        <span className="hamlet-stock" title="Coins">
          <Coins size={14} className="coin-icon" /> {Math.floor(v.coins).toLocaleString()}
        </span>
        <span className="hamlet-goods">
          {shown.map(({ good, name }) => (
            <span key={good} className="hamlet-good" title={`${name}: ${v.stock[good]} in the barn${kept[good] ? `, ${kept[good]} wanted by the carts` : ""}`}>
              <GoodIcon good={good} /> {v.stock[good].toLocaleString()}
            </span>
          ))}
        </span>
        <span className="hamlet-market">
          <button type="button" className="ghost hamlet-sell" onClick={() => (setMenu(undefined), setMarket(!market))} aria-expanded={market}>
            Market
          </button>
          {market && (
            <div className="hamlet-menu market" role="menu">
              <p className="hamlet-menu-note">The market pays less than a cart, and leaves what the carts want.</p>
              {GOODS.filter((g) => spareOf(v, g.good) > 0).map(({ good, name }) => (
                <button key={good} type="button" role="menuitem" onClick={() => commit(sell(current.current, good))}>
                  <GoodIcon good={good} size={16} />
                  <span className="hamlet-sale">
                    <strong>
                      Sell {spareOf(v, good).toLocaleString()} {name.toLowerCase()}
                    </strong>
                    <small>{priceOf(good)} a piece</small>
                  </span>
                  <b>+{(spareOf(v, good) * priceOf(good)).toLocaleString()}</b>
                </button>
              ))}
              {GOODS.every((g) => spareOf(v, g.good) === 0) && <p className="hamlet-menu-note">Nothing spare in the barn.</p>}
            </div>
          )}
        </span>
        <span className="hamlet-gap" />
        <span className={["hamlet-hint", news && "news"].filter(Boolean).join(" ")} aria-live="polite">
          {news ?? "Click ripe crops to harvest, open land to build"}
        </span>
        <button type="button" className="quiet icon-only" onClick={() => setOpen(false)} aria-label="Fold the town away" title="Fold away">
          <ChevronDown size={16} />
        </button>
      </header>
      <div className="hamlet-body">
        <div className="hamlet-scene">
          <Sky />
          <div className="hamlet-plots">
            {v.plots.map((p, i) => (
              <div key={i} className="hamlet-plot">
                <button
                  type="button"
                  className={["hamlet-spot", `on-${p ?? "open"}`, isCrop(p) && v.progress[i] >= 1 && "ripe"].filter(Boolean).join(" ")}
                  onClick={() => tapPlot(i)}
                  onContextMenu={(e) => {
                    if (p === null || p === "wild") return;
                    e.preventDefault();
                    setMarket(false);
                    setMenu(i);
                  }}
                  aria-label={spotLabel(v, i)}
                  aria-haspopup={isCrop(p) ? undefined : "menu"}
                >
                  <Building plot={p} progress={v.progress[i]} />
                  {isCrop(p) && v.progress[i] >= 1 && (
                    <span className="hamlet-ready" aria-hidden>
                      <GoodIcon good={p === "field" ? "wheat" : "apples"} size={13} />
                    </span>
                  )}
                  <Badges v={v} plot={i} kept={kept} />
                </button>
                {isCrop(p) && (
                  <button type="button" className="hamlet-more" onClick={() => (setMarket(false), setMenu(menu === i ? undefined : i))} aria-label={`${building(p).name}: raise or pull down`} title="Raise or pull down">
                    <MoreHorizontal size={14} />
                  </button>
                )}
                {floats
                  .filter((f) => f.plot === i)
                  .map((f) => (
                    <span key={f.id} className="hamlet-float">
                      {f.text}
                      {f.good && <GoodIcon good={f.good} size={12} />}
                    </span>
                  ))}
                {menu === i && (
                  <PlotMenu
                    v={v}
                    plot={i}
                    onDo={(next) => {
                      commit(next);
                      setMenu(undefined);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          {/* Villagers stroll the lane in front of the plots. */}
          <div className="hamlet-street" aria-hidden>
            {Array.from({ length: people }, (_, i) => (
              <span key={i} className="villager-track" style={{ "--d": `${26 + ((i * 7) % 13)}s`, "--delay": `${-i * 4.3}s` } as CSSProperties}>
                <span className="villager">
                  <Sprite name={i % 2 ? "villager-2" : "villager"} />
                </span>
              </span>
            ))}
          </div>
        </div>
        <aside className="hamlet-board" aria-label="Orders from the neighboring villages">
          <h3>Carts at the gate</h3>
          {slots.map((s) => {
            const order = v.orders[s];
            if (s >= capacity(v)) {
              // Only the next slot to open is shown, as a promise.
              if (s > capacity(v)) return null;
              return (
                <div key={s} className="hamlet-order locked">
                  {eraIndex(v) === 0 ? "A second cart comes once the hamlet is a village" : "A trading post makes room for another cart"}
                </div>
              );
            }
            if (!order)
              return (
                <div key={s} className="hamlet-order waiting">
                  <Sprite name="cart" />
                  <span>A cart is on the road · {Math.ceil(v.due[s])} s</span>
                </div>
              );
            const goods = Object.keys(order.want) as Good[];
            const ready = goods.every((g) => v.stock[g] >= order.want[g]!);
            return (
              <div key={s} className={["hamlet-order", ready && "ready"].filter(Boolean).join(" ")}>
                <Sprite name="cart" />
                <div className="hamlet-order-main">
                  <div className="hamlet-order-top">
                    <strong>{order.from}</strong>
                    <span className="hamlet-reward">
                      <Coins size={12} className="coin-icon" /> {order.coins}
                      <Star size={12} className="star-icon" /> {order.stars}
                    </span>
                  </div>
                  <div className="hamlet-wants">
                    {goods.map((g) => (
                      <span key={g} className={["hamlet-want", v.stock[g] >= order.want[g]! && "met"].filter(Boolean).join(" ")} title={`${order.want[g]} ${goodName(g)}`}>
                        <GoodIcon good={g} size={12} />
                        {Math.min(v.stock[g], order.want[g]!)}/{order.want[g]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="hamlet-order-do">
                  <button type="button" className="hamlet-deliver" disabled={!ready} onClick={() => commit(deliver(current.current, s))}>
                    Deliver
                  </button>
                  <button type="button" className="quiet icon-only hamlet-turn" onClick={() => commit(turnAway(current.current, s))} aria-label={`Turn away the cart from ${order.from}`} title="Turn this cart away">
                    <X size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </aside>
      </div>
    </section>
  );
}

function spotLabel(v: Village, i: number): string {
  const p = v.plots[i];
  if (p === null) return "Open land: build here";
  if (p === "wild") return "Wild land: clear it";
  const name = building(p).name;
  if (isCrop(p)) return v.progress[i] >= 1 ? `Ripe ${name.toLowerCase()}: harvest` : `Growing ${name.toLowerCase()}: tend`;
  return `${name}, level ${levelOf(v, i)}`;
}

/** Small marks on a plot: its level, the bonus it gets from its neighbors, and a workshop's work. */
function Badges({ v, plot, kept }: { v: Village; plot: number; kept: Record<Good, number> }) {
  const p = v.plots[plot];
  if (p === null || p === "wild") return null;
  const level = levelOf(v, plot);
  const lift = boosted(v, plot);
  let workshop: ReactNode = null;
  if (isWorkshop(p)) {
    const recipe = RECIPES[p];
    const short = (Object.keys(recipe.takes) as Good[]).find((g) => v.stock[g] - kept[g] < (recipe.takes[g] ?? 0));
    workshop = short ? (
      <span className="hamlet-waits" title={`Waiting for ${goodName(short)}${kept[short] ? " (what the carts asked for is kept back)" : ""}`}>
        <GoodIcon good={short} size={11} />
      </span>
    ) : (
      <span className="hamlet-work" aria-hidden>
        <i style={{ width: `${v.progress[plot] * 100}%` }} />
      </span>
    );
  }
  return (
    <>
      {level > 1 && <span className="hamlet-level">{level === 2 ? "II" : "III"}</span>}
      {lift && (
        <span className="hamlet-lift" title={isCrop(p) ? "Beside a well: ripens faster" : p === "cottage" ? "Beside a garden: villagers work faster" : `Beside a ${building(RECIPES[p as "mill"].feeder).name.toLowerCase()}: twice as fast`}>
          {isCrop(p) ? <Droplet size={11} /> : p === "cottage" ? <Flower2 size={11} /> : "×2"}
        </span>
      )}
      {workshop}
    </>
  );
}

/** How a building would sit on this plot: the bonus its neighbors give it, or that it gives them. */
function spotNote(v: Village, plot: number, kind: Kind): { text: string; good: boolean } | undefined {
  const near = [plot - 1, plot + 1].map((i) => v.plots[i]);
  if (kind === "well" || kind === "garden") {
    const helps = near.filter((p) => (kind === "well" ? isCrop(p) : p === "cottage")).length;
    return helps > 0 ? { text: `helps ${helps === 2 ? "both neighbors" : "a neighbor"}`, good: true } : { text: kind === "well" ? "no crops beside" : "no cottages beside", good: false };
  }
  const placed = { ...v, plots: v.plots.map((p, i) => (i === plot ? kind : p)) as Plot[] };
  if (boosted(placed, plot)) return { text: isCrop(kind) ? "beside a well" : kind === "cottage" ? "beside a garden" : "×2 here", good: true };
  if (isWorkshop(kind)) return { text: `×2 beside a ${building(RECIPES[kind].feeder).name.toLowerCase()}`, good: false };
  return undefined;
}

/** The menu over a plot: what to build on open land, clearing wild land, or a building's own. */
function PlotMenu({ v, plot, onDo }: { v: Village; plot: number; onDo: (next: Village) => void }) {
  const [sure, setSure] = useState(false);
  const p = v.plots[plot];
  const side = plot < 3 ? "start" : plot > 8 ? "end" : "";
  if (p === "wild") {
    const cost = clearCost(v);
    return (
      <div className={["hamlet-menu", side].filter(Boolean).join(" ")} role="menu">
        <button type="button" role="menuitem" disabled={v.coins < cost} onClick={() => onDo(clearWild(v, plot))}>
          <span>
            <strong>Clear the land</strong>
            <small>bushes, weeds and a boulder, gone</small>
          </span>
          <b>{cost.toLocaleString()}</b>
        </button>
      </div>
    );
  }
  if (p === null) {
    const era = eraIndex(v);
    return (
      <div className={["hamlet-menu", "build", side].filter(Boolean).join(" ")} role="menu">
        {BUILDINGS.map((b) => {
          const cost = costOf(v, b.kind);
          const locked = b.era > era;
          const note = locked ? undefined : spotNote(v, plot, b.kind);
          return (
            <button key={b.kind} type="button" role="menuitem" disabled={locked || v.coins < cost} onClick={() => onDo(build(v, plot, b.kind))}>
              <span className="hamlet-menu-art">
                <Sprite name={spriteOf(b.kind, 0)} />
              </span>
              <span>
                <strong>{b.name}</strong>
                <small>{b.does}</small>
                {note && <em className={note.good ? "good" : undefined}>{note.text}</em>}
              </span>
              {locked ? (
                <b className="locked">
                  {ERAS[b.era].name} <Star size={10} className="star-icon" />
                  {ERAS[b.era].stars}
                </b>
              ) : (
                <b>{cost.toLocaleString()}</b>
              )}
            </button>
          );
        })}
      </div>
    );
  }
  const b = building(p);
  const level = levelOf(v, plot);
  const cost = raiseCost(v, plot);
  return (
    <div className={["hamlet-menu", side].filter(Boolean).join(" ")} role="menu">
      <p className="hamlet-menu-head">
        <span>
          <strong>{b.name}</strong>
          {canRaise(p) ? ` · level ${level} of ${MAX_LEVEL}` : ""}
        </span>
        <small>
          {b.does}
          {isWorkshop(p) ? `; twice as fast beside a ${building(RECIPES[p].feeder).name.toLowerCase()}` : ""}
        </small>
      </p>
      {cost !== undefined && (
        <button type="button" role="menuitem" disabled={v.coins < cost} onClick={() => onDo(raise(v, plot))}>
          <span>
            <strong>
              <ChevronsUp size={13} /> Raise to level {level + 1}
            </strong>
            <small>{isCrop(p) ? "bigger harvests" : p === "cottage" ? "two more villagers" : "works faster"}</small>
          </span>
          <b>{cost.toLocaleString()}</b>
        </button>
      )}
      <button type="button" role="menuitem" className="hamlet-pull" onClick={() => (sure ? onDo(demolish(v, plot)) : setSure(true))}>
        <span>
          <strong>{sure ? "Pull it down? Click again" : "Pull down"}</strong>
          <small>leaves open land; nothing is paid back</small>
        </span>
      </button>
    </div>
  );
}

/** The painted sprites, at the size they are drawn on the page in CSS pixels (stored at twice that). */
const SPRITES = {
  cottage: [108, 82],
  bakery: [92, 90],
  mill: [80, 104],
  press: [99, 80],
  post: [94, 76],
  well: [76, 68],
  garden: [56, 36],
  empty: [72, 40],
  wild: [60, 56],
  "field-1": [64, 62],
  "field-2": [64, 62],
  "field-3": [64, 62],
  "orchard-1": [69, 92],
  "orchard-2": [69, 92],
  villager: [22, 30],
  "villager-2": [17, 30],
  cart: [52, 46],
} as const;
type SpriteName = keyof typeof SPRITES;

function Sprite({ name }: { name: SpriteName }) {
  const [w, h] = SPRITES[name];
  return <img className={`sprite ${name}`} src={`${import.meta.env.BASE_URL}hamlet/${name}.webp`} width={w} height={h} alt="" draggable={false} />;
}

function spriteOf(plot: Plot, progress: number): SpriteName {
  if (plot === null) return "empty";
  if (plot === "field") return progress >= 1 ? "field-3" : progress >= 0.45 ? "field-2" : "field-1";
  if (plot === "orchard") return progress >= 1 ? "orchard-2" : "orchard-1";
  return plot;
}

/** A plot's sprite, with smoke from a cottage's or a bakery's chimney. */
function Building({ plot, progress }: { plot: Plot; progress: number }) {
  return (
    <>
      <Sprite name={spriteOf(plot, progress)} />
      {(plot === "cottage" || plot === "bakery") && (
        <span className={`chimney-smoke ${plot}`} aria-hidden>
          <i />
          <i />
        </span>
      )}
    </>
  );
}

/** The sky, the hills and the lane behind the town, drawn in the same ink as the sprites. */
function Sky() {
  return (
    <div className="hamlet-backdrop" aria-hidden>
      <svg className="hamlet-cloud" viewBox="0 0 64 26" aria-hidden>
        <path d="M8 22a7 7 0 0 1 2-13.6A10 10 0 0 1 29 6a9 9 0 0 1 16 2 8 8 0 0 1 11 14z" />
      </svg>
      <svg className="hamlet-cloud late" viewBox="0 0 64 26" aria-hidden>
        <path d="M8 22a7 7 0 0 1 2-13.6A10 10 0 0 1 29 6a9 9 0 0 1 16 2 8 8 0 0 1 11 14z" />
      </svg>
      <svg className="hamlet-hills" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden>
        <path className="far" d="M0 34 C 90 10, 170 12, 250 28 S 420 8, 520 24 S 700 14, 800 26 S 980 6, 1080 22 S 1170 20, 1200 18 V60 H0z" />
        <path className="near" d="M0 46 C 120 30, 220 32, 330 42 S 520 30, 640 40 S 860 28, 960 40 S 1120 34, 1200 38 V60 H0z" />
      </svg>
      <span className="hamlet-lane" />
    </div>
  );
}
