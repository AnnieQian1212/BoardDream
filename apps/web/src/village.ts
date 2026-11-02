/**
 * The hamlet: a strip of land at the foot of the page that grows into a market town while a game
 * is made. Wheat fields ripen by themselves; a click harvests a ripe field or tends a green one.
 * Grain sells for coins, and coins build cottages (each brings a villager who harvests ripe
 * fields), windmills (bigger harvests) and market stalls (which sell grain by themselves). Pure
 * rules, so the page and the tests drive them alike.
 */

export type Kind = "field" | "cottage" | "mill" | "stall";

export const PLOTS = 12;
/** Seconds a field takes to ripen untended. */
export const RIPEN = 16;
/** Coins a sack of grain fetches. */
export const PRICE = 2;
/** Seconds a villager takes to harvest a ripe field. */
export const HARVEST_TIME = 4;
/** A field tended by a click grows this share of the way. */
export const TEND = 0.2;
/** At most this long away is caught up when the page comes back: the town does not run for days. */
export const AWAY_CAP = 30 * 60;

export interface Village {
  coins: number;
  grain: number;
  /** What stands on each plot, left to right. */
  plots: (Kind | null)[];
  /** Each field's growth, 0 (sown) to 1 (ripe); other plots keep 0. */
  growth: number[];
  /** Grain ever harvested, for the record. */
  harvested: number;
  /** Villagers' and stalls' work carried between ticks, in harvests and sales. */
  work: number;
  trade: number;
}

export const BUILDINGS: { kind: Kind; name: string; does: string; base: number }[] = [
  { kind: "field", name: "Wheat field", does: "ripens by itself; click to harvest", base: 8 },
  { kind: "cottage", name: "Cottage", does: "a villager who harvests ripe fields", base: 20 },
  { kind: "mill", name: "Windmill", does: "every harvest gives half again", base: 60 },
  { kind: "stall", name: "Market stall", does: "sells a sack of grain a second", base: 45 },
];

export const start = (): Village => ({
  coins: 0,
  grain: 0,
  plots: ["field", "cottage", "field", ...new Array(PLOTS - 3).fill(null)],
  growth: new Array(PLOTS).fill(0),
  harvested: 0,
  work: 0,
  trade: 0,
});

export const count = (v: Village, kind: Kind) => v.plots.filter((p) => p === kind).length;

/** What the next of a building costs: each one of a kind costs more than the last. */
export function costOf(v: Village, kind: Kind): number {
  const base = BUILDINGS.find((b) => b.kind === kind)!.base;
  return Math.round(base * 1.45 ** count(v, kind));
}

/** Grain a harvest gives: 3, and half again for each windmill. */
export const yieldOf = (v: Village) => Math.round(3 * (1 + 0.5 * count(v, "mill")));

export function build(v: Village, plot: number, kind: Kind): Village {
  const cost = costOf(v, kind);
  if (v.plots[plot] !== null || v.coins < cost) return v;
  const plots = [...v.plots];
  plots[plot] = kind;
  return { ...v, coins: v.coins - cost, plots };
}

/** A click on a field: harvests it if ripe, otherwise tends it. Returns the grain gained. */
export function tap(v: Village, plot: number): { village: Village; gained: number } {
  if (v.plots[plot] !== "field") return { village: v, gained: 0 };
  const growth = [...v.growth];
  if (growth[plot] >= 1) {
    const gained = yieldOf(v);
    growth[plot] = 0;
    return { village: { ...v, growth, grain: v.grain + gained, harvested: v.harvested + gained }, gained };
  }
  growth[plot] = Math.min(1, growth[plot] + TEND);
  return { village: { ...v, growth }, gained: 0 };
}

/** Sells all the grain at the market price. */
export const sellAll = (v: Village): Village => ({ ...v, coins: v.coins + v.grain * PRICE, grain: 0 });

/**
 * `dt` seconds pass: fields grow, villagers harvest ripe fields (one each per HARVEST_TIME), and
 * stalls sell a sack each per second. Returns the fields harvested, so the page can show them.
 */
export function tick(v: Village, dt: number): { village: Village; harvestedPlots: number[] } {
  const growth = v.growth.map((g, i) => (v.plots[i] === "field" ? Math.min(1, g + dt / RIPEN) : 0));
  let { grain, harvested, coins } = v;
  const villagers = count(v, "cottage");
  let work = villagers > 0 ? v.work + (villagers * dt) / HARVEST_TIME : 0;
  const done: number[] = [];
  while (work >= 1) {
    const ripe = growth.findIndex((g, i) => v.plots[i] === "field" && g >= 1);
    if (ripe < 0) {
      // Nothing ripe: villagers wait rather than bank harvests for later.
      work = Math.min(work, 1);
      break;
    }
    growth[ripe] = 0;
    grain += yieldOf(v);
    harvested += yieldOf(v);
    done.push(ripe);
    work -= 1;
  }
  const stalls = count(v, "stall");
  let trade = stalls > 0 ? v.trade + stalls * dt : 0;
  const sold = Math.min(grain, Math.floor(trade));
  grain -= sold;
  coins += sold * PRICE;
  trade -= Math.floor(trade);
  return { village: { ...v, growth, grain, harvested, coins, work, trade }, harvestedPlots: done };
}

/** Catches up `seconds` away from the page (capped at AWAY_CAP), a second at a time. */
export function catchUp(v: Village, seconds: number): Village {
  let out = v;
  const steps = Math.floor(Math.min(Math.max(0, seconds), AWAY_CAP));
  for (let i = 0; i < steps; i++) out = tick(out, 1).village;
  return out;
}

/** The town's name by how much of the land is built on. */
export function eraOf(v: Village): string {
  const built = v.plots.filter(Boolean).length;
  return built >= PLOTS ? "Harvest town" : built >= 9 ? "Market town" : built >= 6 ? "Village" : "Hamlet";
}

/** A saved village, made whole: missing or malformed fields fall back to a new one's. */
export function revive(value: unknown): Village {
  const base = start();
  if (!value || typeof value !== "object") return base;
  const v = value as Partial<Record<keyof Village, unknown>>;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : 0);
  const kinds = new Set<unknown>(BUILDINGS.map((b) => b.kind));
  const plots = Array.isArray(v.plots) && v.plots.length === PLOTS ? v.plots.map((p) => (kinds.has(p) ? (p as Kind) : null)) : base.plots;
  const growth = Array.isArray(v.growth) && v.growth.length === PLOTS ? v.growth.map((g, i) => (plots[i] === "field" ? Math.min(1, num(g)) : 0)) : base.growth;
  return { coins: Math.floor(num(v.coins)), grain: Math.floor(num(v.grain)), plots, growth, harvested: Math.floor(num(v.harvested)), work: Math.min(1, num(v.work)), trade: Math.min(1, num(v.trade)) };
}
