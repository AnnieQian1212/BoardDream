import { ChevronDown, Coins, Home, Wheat } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useEscape } from "../escape";
import { BUILDINGS, build, catchUp, costOf, count, eraOf, PRICE, revive, sellAll, start, tap, tick, yieldOf, type Kind, type Village } from "../village";

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
export const HAMLET_HEIGHT = 168;

interface Float {
  id: number;
  plot: number;
  text: string;
}

/**
 * Something to tend while a game is made: a strip of land at the foot of the page that grows from
 * a hamlet into a market town. Click ripe wheat to harvest it (or green wheat to tend it), sell the
 * grain, and build cottages whose villagers harvest for you, windmills and market stalls. It is
 * kept in this browser and keeps working, for a while, between games.
 */
export function Hamlet() {
  const open = useHamletOpen();
  const [v, setV] = useState<Village>(load);
  const current = useRef(v);
  current.current = v;
  const [menu, setMenu] = useState<number>();
  const [floats, setFloats] = useState<Float[]>([]);
  const nextFloat = useRef(0);
  useEscape(() => setMenu(undefined), menu !== undefined);

  const float = (plot: number, text: string) => {
    const id = nextFloat.current++;
    setFloats((f) => [...f, { id, plot, text }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1100);
  };
  const commit = (next: Village) => {
    current.current = next;
    setV(next);
  };

  // A quarter second at a time: fields grow, villagers harvest, stalls sell.
  useEffect(() => {
    const timer = setInterval(() => {
      const { village, harvestedPlots } = tick(current.current, 0.25);
      commit(village);
      for (const plot of harvestedPlots) float(plot, `+${yieldOf(village)}`);
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
      <button type="button" className="hamlet-tab" onClick={() => setOpen(true)} title="A hamlet to tend while you wait">
        <Home size={15} /> {eraOf(v)} · {Math.floor(v.coins).toLocaleString()} coins
      </button>
    );
  }

  const tapPlot = (plot: number) => {
    const kind = v.plots[plot];
    if (kind === null) return setMenu(menu === plot ? undefined : plot);
    setMenu(undefined);
    if (kind !== "field") return;
    const { village, gained } = tap(current.current, plot);
    commit(village);
    float(plot, gained > 0 ? `+${gained}` : "tended");
  };
  const villagers = Math.min(10, count(v, "cottage"));
  const built = v.plots.filter(Boolean).length;

  return (
    <section className="hamlet" aria-label="A hamlet to tend while your game is made">
      <header className="hamlet-head">
        <strong>{eraOf(v)}</strong>
        <span className="hamlet-built">{built} of 12 plots built</span>
        <span className="hamlet-stock" title="Coins">
          <Coins size={14} /> {Math.floor(v.coins).toLocaleString()}
        </span>
        <span className="hamlet-stock" title="Grain in the barn">
          <Wheat size={14} /> {v.grain.toLocaleString()}
        </span>
        <button type="button" className="ghost hamlet-sell" disabled={v.grain === 0} onClick={() => commit(sellAll(current.current))} title={`Sell all the grain at ${PRICE} coins a sack`}>
          Sell grain {v.grain > 0 && <b>+{(v.grain * PRICE).toLocaleString()}</b>}
        </button>
        <span className="hamlet-gap" />
        <span className="hamlet-hint">Click ripe wheat to harvest, an empty plot to build</span>
        <button type="button" className="quiet icon-only" onClick={() => setOpen(false)} aria-label="Fold the hamlet away" title="Fold away">
          <ChevronDown size={16} />
        </button>
      </header>
      <div className="hamlet-scene">
        <span className="hamlet-cloud" aria-hidden />
        <span className="hamlet-cloud late" aria-hidden />
        <span className="hamlet-hills" aria-hidden />
        <div className="hamlet-street" aria-hidden>
          {Array.from({ length: villagers }, (_, i) => (
            <span key={i} className="villager" style={{ "--d": `${22 + ((i * 7) % 13)}s`, "--delay": `${-i * 4.3}s` } as CSSProperties}>
              <Sprite name="villager" />
            </span>
          ))}
        </div>
        <div className="hamlet-plots">
          {v.plots.map((kind, i) => (
            <div key={i} className="hamlet-plot">
              <button
                type="button"
                className={["hamlet-spot", kind ?? "empty", kind === "field" && v.growth[i] >= 1 && "ripe"].filter(Boolean).join(" ")}
                onClick={() => tapPlot(i)}
                aria-label={kind === null ? "Empty plot: build here" : kind === "field" ? (v.growth[i] >= 1 ? "Ripe wheat: harvest" : "Growing wheat: tend") : BUILDINGS.find((b) => b.kind === kind)!.name}
                title={kind && kind !== "field" ? `${BUILDINGS.find((b) => b.kind === kind)!.name}: ${BUILDINGS.find((b) => b.kind === kind)!.does}` : undefined}
              >
                <Building kind={kind} growth={v.growth[i]} />
              </button>
              {floats
                .filter((f) => f.plot === i)
                .map((f) => (
                  <span key={f.id} className="hamlet-float">
                    {f.text}
                  </span>
                ))}
              {menu === i && (
                <div className={["hamlet-menu", i > 8 && "end"].filter(Boolean).join(" ")} role="menu">
                  {BUILDINGS.map((b) => {
                    const cost = costOf(v, b.kind);
                    return (
                      <button
                        key={b.kind}
                        type="button"
                        role="menuitem"
                        disabled={v.coins < cost}
                        onClick={() => {
                          commit(build(current.current, i, b.kind));
                          setMenu(undefined);
                        }}
                      >
                        <span>
                          <strong>{b.name}</strong>
                          <small>{b.does}</small>
                        </span>
                        <b>{cost.toLocaleString()}</b>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The pixel sprites, at their size in art pixels; the page draws each art pixel 2 screen pixels wide. */
const SPRITES = {
  "wheat-1": [41, 30],
  "wheat-2": [42, 36],
  "wheat-3": [38, 36],
  empty: [33, 34],
  cottage: [41, 42],
  mill: [40, 48],
  stall: [33, 38],
  villager: [14, 18],
} as const;
const PIXEL = 2;

function Sprite({ name }: { name: keyof typeof SPRITES }) {
  const [w, h] = SPRITES[name];
  return <img className="sprite" src={`${import.meta.env.BASE_URL}hamlet/${name}.png`} width={w * PIXEL} height={h * PIXEL} alt="" draggable={false} />;
}

/** A plot's sprite: wheat in three stages by its growth, or the building that stands there. */
function Building({ kind, growth }: { kind: Kind | null; growth: number }) {
  if (kind === "field") return <Sprite name={growth >= 1 ? "wheat-3" : growth >= 0.45 ? "wheat-2" : "wheat-1"} />;
  if (kind === "cottage")
    return (
      <>
        <Sprite name="cottage" />
        <span className="chimney-smoke" aria-hidden>
          <i />
          <i />
        </span>
      </>
    );
  if (kind === "mill") return <Sprite name="mill" />;
  if (kind === "stall") return <Sprite name="stall" />;
  return <Sprite name="empty" />;
}
