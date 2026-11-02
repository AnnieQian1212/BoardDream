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
        <svg className="hamlet-hills" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden>
          <path d="M0 60 L0 34 C120 10 220 14 340 30 C460 46 560 18 700 22 C840 26 920 44 1040 30 C1110 22 1160 20 1200 26 L1200 60Z" />
        </svg>
        <div className="hamlet-street" aria-hidden>
          {Array.from({ length: villagers }, (_, i) => (
            <span key={i} className="villager" style={{ "--d": `${14 + ((i * 7) % 11)}s`, "--delay": `${-i * 3.1}s`, "--shirt": SHIRTS[i % SHIRTS.length] } as CSSProperties}>
              <svg viewBox="0 0 10 20">
                <circle cx="5" cy="4" r="3" className="villager-head" />
                <path d="M1.5 19 L2.5 9 Q5 7 7.5 9 L8.5 19Z" fill="var(--shirt)" />
              </svg>
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
                <Building kind={kind} growth={v.growth[i]} seed={i} />
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

const SHIRTS = ["#c8643c", "#4f7f9f", "#7a9a4a", "#9a5f9a", "#d9a233", "#3f7d6a"];
const ROOFS = ["#b4543a", "#4f6f9a", "#5f7d45", "#8a4f6a", "#a0723a"];

/** A plot's building, drawn small in the storybook's flat colors. */
function Building({ kind, growth, seed }: { kind: Kind | null; growth: number; seed: number }) {
  if (kind === "field") {
    const g = Math.min(1, growth);
    const stalk = `hsl(${100 - 56 * g} ${45 + 25 * g}% ${36 + 20 * g}%)`;
    return (
      <svg viewBox="0 0 100 90" preserveAspectRatio="xMidYMax meet">
        <rect x="6" y="72" width="88" height="14" rx="3" className="soil" />
        {Array.from({ length: 10 }, (_, k) => {
          const x = 12 + k * 8.4;
          const h = 8 + g * 38 - ((k * 5) % 3) * 2;
          return (
            <g key={k}>
              <line x1={x} y1="74" x2={x + 1.5} y2={74 - h} stroke={stalk} strokeWidth="2.6" strokeLinecap="round" />
              {g > 0.55 && <ellipse cx={x + 1.6} cy={74 - h - 3} rx="2.1" ry="4.6" fill={g >= 1 ? "#e8b84a" : "#c9c25a"} />}
            </g>
          );
        })}
      </svg>
    );
  }
  if (kind === "cottage") {
    return (
      <svg viewBox="0 0 100 90" preserveAspectRatio="xMidYMax meet">
        <rect x="62" y="22" width="8" height="16" className="wall" />
        <circle cx="66" cy="16" r="4" className="smoke" />
        <circle cx="70" cy="9" r="5" className="smoke late" />
        <rect x="26" y="46" width="48" height="36" className="wall" />
        <polygon points="18,48 50,20 82,48" fill={ROOFS[seed % ROOFS.length]} className="roof" />
        <rect x="45" y="60" width="11" height="22" rx="1.5" className="door" />
        <rect x="31" y="54" width="9" height="9" className="window" />
        <rect x="61" y="54" width="9" height="9" className="window" />
      </svg>
    );
  }
  if (kind === "mill") {
    return (
      <svg viewBox="0 0 100 90" preserveAspectRatio="xMidYMax meet">
        <polygon points="38,82 44,34 56,34 62,82" className="wall" />
        <polygon points="40,36 50,24 60,36" fill="#8a5a3a" className="roof" />
        <rect x="46" y="66" width="8" height="16" className="door" />
        <g className="sails">
          {[0, 90, 180, 270].map((a) => (
            <rect key={a} x="48.5" y="2" width="3" height="28" transform={`rotate(${a} 50 32)`} className="sail" />
          ))}
          <circle cx="50" cy="32" r="3" className="hub" />
        </g>
      </svg>
    );
  }
  if (kind === "stall") {
    return (
      <svg viewBox="0 0 100 90" preserveAspectRatio="xMidYMax meet">
        <rect x="22" y="40" width="3" height="42" className="post" />
        <rect x="75" y="40" width="3" height="42" className="post" />
        <polygon points="16,42 22,26 78,26 84,42" fill="#f3e6cc" className="roof" />
        {[0, 1, 2, 3, 4].map((k) => (
          <polygon key={k} points={`${16 + k * 13.6},42 ${22 + k * 11.2},26 ${22 + (k + 0.5) * 11.2},26 ${16 + (k + 0.5) * 13.6},42`} fill="#c8643c" />
        ))}
        <rect x="22" y="62" width="56" height="20" className="counter" />
        <circle cx="34" cy="60" r="5" fill="#e2c27a" className="sack" />
        <circle cx="47" cy="60" r="5" fill="#e2c27a" className="sack" />
        <rect x="57" y="53" width="13" height="9" fill="#a8743f" className="sack" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 90" preserveAspectRatio="xMidYMax meet">
      <rect x="10" y="62" width="80" height="22" rx="5" className="plot-outline" />
      <rect x="47" y="40" width="3" height="26" className="post" />
      <rect x="34" y="40" width="30" height="13" rx="2" className="sign" />
      <text x="49" y="50" className="sign-text">
        +
      </text>
    </svg>
  );
}
