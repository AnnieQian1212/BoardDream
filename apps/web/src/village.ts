/**
 * The hamlet: a strip of land at the foot of the page that grows into a trading town while a game
 * is made. Crops ripen by themselves (a click harvests a ripe one or tends a green one), villagers
 * from the cottages bring in the rest, and workshops grind wheat into flour, bake flour into bread
 * and press apples into cider (never touching what a waiting cart has asked for). Carts from
 * neighboring villages wait with orders: filling one earns coins and a star or two, and stars grow
 * the town and unlock what it can build. Where things stand matters: a well speeds the crops beside
 * it, a garden cheers the cottages beside it, and a workshop works twice as fast beside what feeds
 * it. Crops, cottages and workshops can be raised two levels for coins, each level as much again.
 * Pure rules, so the page and the tests drive them alike.
 */

export type Good = "wheat" | "apples" | "flour" | "bread" | "cider";
export type Kind = "field" | "orchard" | "cottage" | "well" | "garden" | "mill" | "bakery" | "press" | "post";
/** A plot holds a building, open land (null), or wild land still to clear. */
export type Plot = Kind | "wild" | null;
export type Stock = Record<Good, number>;

export interface Order {
  /** The neighboring village the cart comes from. */
  from: string;
  want: Partial<Stock>;
  coins: number;
  stars: number;
}

export interface Village {
  coins: number;
  stock: Stock;
  /** What stands on each plot, left to right. */
  plots: Plot[];
  /** Each crop's growth (0 sown, 1 ripe), or each workshop's progress on its batch; 0 elsewhere. */
  progress: number[];
  /** Each plot's level, 1 to MAX_LEVEL: a crop yields, a cottage houses and a workshop works that many times over. */
  levels: number[];
  stars: number;
  /** The carts' orders, one per slot; null while the next cart is on its way. */
  orders: (Order | null)[];
  /** Seconds until a cart reaches each empty slot. */
  due: number[];
  /** Villagers' harvests carried between ticks. */
  work: number;
  /** The orders' dice. */
  seed: number;
  /** Orders filled, for the record. */
  delivered: number;
}

export const PLOTS = 12;
/** Order slots at most: one to start, one more from the Village on, one more with a trading post. */
export const SLOTS = 3;
/** A click on a green crop grows it this share of the way. */
export const TEND = 0.2;
/** Seconds a villager takes to bring in a ripe crop, from when it ripens: the player can beat them to it. */
export const HARVEST_TIME = 10;
export const VILLAGERS_PER_COTTAGE = 2;
/** Seconds before the next cart comes, after one leaves filled or is turned away. */
export const CART_GAP = 20;
export const TURN_AWAY_GAP = 30;
/** At most this long away is caught up when the page comes back: the town does not run for days. */
export const AWAY_CAP = 30 * 60;
export const MAX_LEVEL = 3;
/** Wild plots at the start; clearing each costs more than the last. */
const WILD = 7;

export const GOODS: { good: Good; name: string; price: number; era: number }[] = [
  { good: "wheat", name: "Wheat", price: 1, era: 0 },
  { good: "apples", name: "Apples", price: 2, era: 1 },
  { good: "flour", name: "Flour", price: 3, era: 1 },
  { good: "bread", name: "Bread", price: 8, era: 2 },
  { good: "cider", name: "Cider", price: 9, era: 2 },
];
const PRICE = Object.fromEntries(GOODS.map((g) => [g.good, g.price])) as Stock;

export const CROPS: Record<"field" | "orchard", { seconds: number; good: Good; n: number }> = {
  field: { seconds: 14, good: "wheat", n: 3 },
  orchard: { seconds: 26, good: "apples", n: 4 },
};

export const RECIPES: Record<"mill" | "bakery" | "press", { takes: Partial<Stock>; makes: Good; seconds: number; feeder: Kind }> = {
  mill: { takes: { wheat: 1 }, makes: "flour", seconds: 4, feeder: "field" },
  bakery: { takes: { flour: 2 }, makes: "bread", seconds: 8, feeder: "mill" },
  press: { takes: { apples: 3 }, makes: "cider", seconds: 8, feeder: "orchard" },
};

export const ERAS: { name: string; stars: number }[] = [
  { name: "Hamlet", stars: 0 },
  { name: "Village", stars: 4 },
  { name: "Market town", stars: 14 },
  { name: "Trade town", stars: 40 },
];

export const BUILDINGS: { kind: Kind; name: string; does: string; base: number; era: number }[] = [
  { kind: "field", name: "Wheat field", does: "ripens into 3 wheat", base: 8, era: 0 },
  { kind: "cottage", name: "Cottage", does: "two villagers bring in ripe crops", base: 20, era: 0 },
  { kind: "well", name: "Well", does: "crops beside it grow ×1.5 as fast", base: 22, era: 0 },
  { kind: "garden", name: "Flower garden", does: "cottages beside it work ×1.5 as fast", base: 14, era: 0 },
  { kind: "orchard", name: "Orchard", does: "ripens into 4 apples", base: 30, era: 1 },
  { kind: "mill", name: "Windmill", does: "grinds wheat into flour", base: 40, era: 1 },
  { kind: "bakery", name: "Bakery", does: "bakes 2 flour into bread", base: 70, era: 2 },
  { kind: "press", name: "Cider press", does: "presses 3 apples into cider", base: 70, era: 2 },
  { kind: "post", name: "Trading post", does: "room for one more cart", base: 90, era: 2 },
];
export const building = (kind: Kind) => BUILDINGS.find((b) => b.kind === kind)!;

const NEIGHBORS = ["Fernbrook", "Hollowell", "Brackenford", "Thistledown", "Larkspur Hill", "Pebbleford", "Rushmere", "Oakhollow"];
/** How much of a good a cart asks for, for each building that makes it: about forty seconds' work. */
const ASK: Stock = { wheat: 6, apples: 4, flour: 4, bread: 2, cider: 2 };
const MAKER: Record<Good, Kind> = { wheat: "field", apples: "orchard", flour: "mill", bread: "bakery", cider: "press" };

export const isCrop = (p: Plot): p is "field" | "orchard" => p === "field" || p === "orchard";
export const isWorkshop = (p: Plot): p is "mill" | "bakery" | "press" => p === "mill" || p === "bakery" || p === "press";
export const count = (v: Village, kind: Plot) => v.plots.filter((p) => p === kind).length;
/** Buildings that can be raised a level. */
export const canRaise = (p: Plot) => isCrop(p) || isWorkshop(p) || p === "cottage";
export const levelOf = (v: Village, plot: number) => (canRaise(v.plots[plot]) ? (v.levels[plot] ?? 1) : 1);
/** The levels of all the buildings of a kind, added up. */
const levels = (v: Village, kind: Kind) => v.plots.reduce((sum, p, i) => sum + (p === kind ? levelOf(v, i) : 0), 0);
const beside = (v: Village, i: number, kind: Kind) => v.plots[i - 1] === kind || v.plots[i + 1] === kind;

/** Whether the building on a plot gets its bonus from what stands beside it. */
export function boosted(v: Village, i: number): boolean {
  const p = v.plots[i];
  if (isCrop(p)) return beside(v, i, "well");
  if (p === "cottage") return beside(v, i, "garden");
  if (isWorkshop(p)) return beside(v, i, RECIPES[p].feeder);
  return false;
}

export function eraIndex(v: Village): number {
  let era = 0;
  ERAS.forEach((e, i) => {
    if (v.stars >= e.stars) era = i;
  });
  return era;
}
export const eraOf = (v: Village) => ERAS[eraIndex(v)].name;
/** The next stage of the town and the stars it takes, or undefined at the last. */
export const nextEra = (v: Village) => ERAS[eraIndex(v) + 1];

/** Orders the town can have waiting at once. */
export const capacity = (v: Village) => Math.min(SLOTS, 1 + Math.min(1, eraIndex(v)) + count(v, "post"));

/** Villagers living in the town. */
export const villagers = (v: Village) => VILLAGERS_PER_COTTAGE * levels(v, "cottage");

/** What the next of a building costs: each one of a kind costs more than the last. */
export const costOf = (v: Village, kind: Kind) => Math.round(building(kind).base * 1.5 ** count(v, kind));

/** What raising a building one level costs: five times its base price, times its level squared. */
export function raiseCost(v: Village, plot: number): number | undefined {
  const p = v.plots[plot];
  if (!canRaise(p) || levelOf(v, plot) >= MAX_LEVEL) return undefined;
  return Math.round(building(p as Kind).base * 5 * levelOf(v, plot) ** 2);
}

/** What clearing the next wild plot costs. */
export const clearCost = (v: Village) => Math.round(12 * 1.6 ** Math.max(0, WILD - count(v, "wild")));

const has = (stock: Stock, want: Partial<Stock>) => (Object.keys(want) as Good[]).every((g) => stock[g] >= (want[g] ?? 0));
const take = (stock: Stock, want: Partial<Stock>) => {
  for (const g of Object.keys(want) as Good[]) stock[g] -= want[g] ?? 0;
};

/** The next number from the orders' dice, in [0, 1), and the dice after the throw. */
function roll(seed: number): [number, number] {
  const t = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

/** Goods the town can make now: a cart only asks for those. */
function makeable(v: Village): Good[] {
  const out = GOODS.filter((g) => g.era <= eraIndex(v) && count(v, MAKER[g.good]) > 0).map((g) => g.good);
  return out.length > 0 ? out : ["wheat"];
}

/** What the waiting carts have asked for, which the workshops leave alone. */
export function promised(v: Village): Stock {
  const out: Stock = { wheat: 0, apples: 0, flour: 0, bread: 0, cider: 0 };
  for (const o of v.orders) for (const g of Object.keys(o?.want ?? {}) as Good[]) out[g] += o!.want[g] ?? 0;
  return out;
}

/**
 * A cart's order, sized to the town: about forty seconds of what the buildings that make each good
 * can make, more lines once the town is a trade town, and a second star for bread or cider.
 */
export function makeOrder(v: Village): { order: Order; seed: number } {
  let seed = v.seed;
  const next = () => {
    const [x, s] = roll(seed);
    seed = s;
    return x;
  };
  const era = eraIndex(v);
  const from = NEIGHBORS[Math.floor(next() * NEIGHBORS.length)];
  const pool = makeable(v);
  const lines = Math.min(pool.length, era === 0 ? 1 : era < 3 ? 1 + Math.floor(next() * 2) : 2 + Math.floor(next() * 2));
  const want: Partial<Stock> = {};
  while (Object.keys(want).length < lines) {
    const g = pool[Math.floor(next() * pool.length)];
    if (want[g] === undefined) want[g] = Math.max(1, Math.round(ASK[g] * Math.max(1, levels(v, MAKER[g])) * (0.8 + 0.5 * next())));
  }
  const goods = Object.keys(want) as Good[];
  const value = goods.reduce((sum, g) => sum + (want[g] ?? 0) * PRICE[g], 0);
  const fine = goods.some((g) => g === "bread" || g === "cider");
  return { order: { from, want, coins: Math.round(value * 2), stars: fine ? 2 : 1 }, seed };
}

export function start(): Village {
  const v: Village = {
    coins: 0,
    stock: { wheat: 0, apples: 0, flour: 0, bread: 0, cider: 0 },
    plots: ["field", "cottage", "field", null, null, ...new Array<Plot>(WILD).fill("wild")],
    progress: [0.85, 0, 0.5, ...new Array(PLOTS - 3).fill(0)],
    levels: new Array(PLOTS).fill(1),
    stars: 0,
    orders: new Array(SLOTS).fill(null),
    due: new Array(SLOTS).fill(0),
    work: 0,
    seed: 20261102,
    delivered: 0,
  };
  const { order, seed } = makeOrder(v);
  return { ...v, orders: [order, null, null], seed };
}

export function build(v: Village, plot: number, kind: Kind): Village {
  const cost = costOf(v, kind);
  if (v.plots[plot] !== null || v.coins < cost || building(kind).era > eraIndex(v)) return v;
  const plots = [...v.plots];
  plots[plot] = kind;
  const progress = [...v.progress];
  progress[plot] = 0;
  const levels = [...v.levels];
  levels[plot] = 1;
  return { ...v, coins: v.coins - cost, plots, progress, levels };
}

/** Raises a building a level, for coins. */
export function raise(v: Village, plot: number): Village {
  const cost = raiseCost(v, plot);
  if (cost === undefined || v.coins < cost) return v;
  const levels = [...v.levels];
  levels[plot] = levelOf(v, plot) + 1;
  return { ...v, coins: v.coins - cost, levels };
}

/** Clears a wild plot for building, for coins. */
export function clearWild(v: Village, plot: number): Village {
  const cost = clearCost(v);
  if (v.plots[plot] !== "wild" || v.coins < cost) return v;
  const plots = [...v.plots];
  plots[plot] = null;
  return { ...v, coins: v.coins - cost, plots };
}

/** Pulls a building down, leaving open land (nothing is paid back). */
export function demolish(v: Village, plot: number): Village {
  const p = v.plots[plot];
  if (p === null || p === "wild") return v;
  const plots = [...v.plots];
  plots[plot] = null;
  const progress = [...v.progress];
  progress[plot] = 0;
  const levels = [...v.levels];
  levels[plot] = 1;
  return { ...v, plots, progress, levels };
}

export interface Made {
  plot: number;
  good: Good;
  n: number;
}

/** A click on a crop: harvests it if ripe, otherwise tends it a little. */
export function tap(v: Village, plot: number): { village: Village; made?: Made } {
  const p = v.plots[plot];
  if (!isCrop(p)) return { village: v };
  const progress = [...v.progress];
  if (progress[plot] >= 1) {
    const good = CROPS[p].good;
    const n = CROPS[p].n * levelOf(v, plot);
    progress[plot] = 0;
    return { village: { ...v, progress, stock: { ...v.stock, [good]: v.stock[good] + n } }, made: { plot, good, n } };
  }
  progress[plot] = Math.min(1, progress[plot] + TEND);
  return { village: { ...v, progress } };
}

/** Fills a cart's order from the barn, if it holds enough: the cart pays and the town earns stars. */
export function deliver(v: Village, slot: number): Village {
  const order = v.orders[slot];
  if (!order || !has(v.stock, order.want)) return v;
  const stock = { ...v.stock };
  take(stock, order.want);
  const orders = [...v.orders];
  orders[slot] = null;
  const due = [...v.due];
  due[slot] = CART_GAP;
  return { ...v, stock, orders, due, coins: v.coins + order.coins, stars: v.stars + order.stars, delivered: v.delivered + 1 };
}

/** Sends a cart away unfilled; another comes, a little later. */
export function turnAway(v: Village, slot: number): Village {
  if (!v.orders[slot]) return v;
  const orders = [...v.orders];
  orders[slot] = null;
  const due = [...v.due];
  due[slot] = TURN_AWAY_GAP;
  return { ...v, orders, due };
}

/** What the barn holds of a good beyond what the waiting carts have asked for. */
export const spareOf = (v: Village, good: Good) => Math.max(0, v.stock[good] - promised(v)[good]);

/** Sells the spare of a good at the market, for less than a cart pays; the carts' share stays. */
export function sell(v: Village, good: Good): Village {
  const n = spareOf(v, good);
  return { ...v, coins: v.coins + n * PRICE[good], stock: { ...v.stock, [good]: v.stock[good] - n } };
}
export const priceOf = (good: Good) => PRICE[good];

/**
 * `dt` seconds pass: crops grow, villagers bring in ripe crops (leftmost first), workshops work
 * while the barn holds their inputs beyond what the carts have asked for, and carts arrive at empty
 * order slots. Returns what was made where, so the page can show it.
 */
export function tick(v: Village, dt: number): { village: Village; made: Made[] } {
  const progress = [...v.progress];
  const stock = { ...v.stock };
  const made: Made[] = [];

  v.plots.forEach((p, i) => {
    if (isCrop(p)) progress[i] = Math.min(1, progress[i] + (dt / CROPS[p].seconds) * (boosted(v, i) ? 1.5 : 1));
  });

  let rate = 0;
  v.plots.forEach((p, i) => {
    if (p === "cottage") rate += (VILLAGERS_PER_COTTAGE * levelOf(v, i) * (boosted(v, i) ? 1.5 : 1)) / HARVEST_TIME;
  });
  // Villagers rest while nothing is ripe, and set out to a crop only once it ripens.
  const ripeAt = () => v.plots.findIndex((p, i) => isCrop(p) && progress[i] >= 1);
  let work = rate > 0 && ripeAt() >= 0 ? v.work + rate * dt : 0;
  while (work >= 1) {
    const ripe = ripeAt();
    if (ripe < 0) break;
    const good = CROPS[v.plots[ripe] as "field" | "orchard"].good;
    const n = CROPS[v.plots[ripe] as "field" | "orchard"].n * levelOf(v, ripe);
    stock[good] += n;
    progress[ripe] = 0;
    made.push({ plot: ripe, good, n });
    work -= 1;
  }
  if (ripeAt() < 0) work = 0;

  const kept = promised(v);
  const spare = (takes: Partial<Stock>) => (Object.keys(takes) as Good[]).every((g) => stock[g] - kept[g] >= (takes[g] ?? 0));
  v.plots.forEach((p, i) => {
    if (!isWorkshop(p)) return;
    const recipe = RECIPES[p];
    // A workshop waits, its batch kept, while the barn has nothing spare of what it takes.
    if (!spare(recipe.takes)) return;
    progress[i] += (dt / recipe.seconds) * levelOf(v, i) * (boosted(v, i) ? 2 : 1);
    while (progress[i] >= 1 && spare(recipe.takes)) {
      take(stock, recipe.takes);
      stock[recipe.makes] += 1;
      made.push({ plot: i, good: recipe.makes, n: 1 });
      progress[i] -= 1;
    }
    progress[i] = Math.min(1, progress[i]);
  });

  let out: Village = { ...v, progress, stock, work };
  const open = capacity(v);
  for (let s = 0; s < SLOTS; s++) {
    if (s >= open || out.orders[s]) continue;
    const due = [...out.due];
    due[s] = Math.max(0, due[s] - dt);
    out = { ...out, due };
    if (due[s] > 0) continue;
    const { order, seed } = makeOrder(out);
    const orders = [...out.orders];
    orders[s] = order;
    out = { ...out, orders, seed };
  }
  return { village: out, made };
}

/** Catches up `seconds` away from the page (capped at AWAY_CAP), a second at a time. */
export function catchUp(v: Village, seconds: number): Village {
  let out = v;
  const steps = Math.floor(Math.min(Math.max(0, seconds), AWAY_CAP));
  for (let i = 0; i < steps; i++) out = tick(out, 1).village;
  return out;
}

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : 0);

function reviveOrder(value: unknown): Order | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Partial<Record<keyof Order, unknown>>;
  if (typeof o.from !== "string" || !o.want || typeof o.want !== "object") return null;
  const want: Partial<Stock> = {};
  for (const { good } of GOODS) {
    const n = Math.floor(num((o.want as Record<string, unknown>)[good]));
    if (n > 0) want[good] = n;
  }
  if (Object.keys(want).length === 0) return null;
  return { from: o.from, want, coins: Math.floor(num(o.coins)), stars: Math.floor(num(o.stars)) };
}

/**
 * A saved village, made whole: missing or malformed fields fall back to a new one's. A village
 * saved before the town grew orders keeps its land (its open plots stay open), its coins and its
 * grain as wheat; its market stalls become trading posts.
 */
export function revive(value: unknown): Village {
  const base = start();
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;
  const kinds = new Set<unknown>([...BUILDINGS.map((b) => b.kind), "wild"]);
  const renamed: Record<string, Kind> = { stall: "post" };
  const plots: Plot[] =
    Array.isArray(v.plots) && v.plots.length === PLOTS
      ? v.plots.map((p) => (typeof p === "string" && renamed[p] ? renamed[p] : kinds.has(p) ? (p as Plot) : null))
      : base.plots;
  const saved = Array.isArray(v.progress) ? v.progress : Array.isArray(v.growth) ? v.growth : [];
  const progress = plots.map((p, i) => (isCrop(p) || isWorkshop(p) ? Math.min(1, num(saved[i])) : 0));
  const levels = plots.map((p, i) => (canRaise(p) && Array.isArray(v.levels) ? Math.min(MAX_LEVEL, Math.max(1, Math.floor(num(v.levels[i])))) : 1));
  const s = (v.stock && typeof v.stock === "object" ? v.stock : {}) as Record<string, unknown>;
  const stock = Object.fromEntries(GOODS.map(({ good }) => [good, Math.floor(num(s[good]))])) as Stock;
  if (!v.stock) stock.wheat = Math.floor(num(v.grain));
  const orders = Array.from({ length: SLOTS }, (_, i) => (Array.isArray(v.orders) ? reviveOrder(v.orders[i]) : null));
  const due = Array.from({ length: SLOTS }, (_, i) => (Array.isArray(v.due) ? Math.min(TURN_AWAY_GAP, num(v.due[i])) : 0));
  return {
    coins: Math.floor(num(v.coins)),
    stock,
    plots,
    progress,
    levels,
    stars: Math.floor(num(v.stars)),
    orders,
    due,
    work: Math.min(1, num(v.work)),
    seed: typeof v.seed === "number" && Number.isInteger(v.seed) ? v.seed : base.seed,
    delivered: Math.floor(num(v.delivered)),
  };
}
