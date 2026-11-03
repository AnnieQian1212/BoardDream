/**
 * The mochi steamer, played while a game is made. A steamer sets fresh dewdrops on a picnic
 * blanket, and two friends alike pressed together become the next friend up the line, from a
 * dewdrop to the moon; two moons rise to the sky as a star. Woodland neighbors leave order cards
 * asking for friends and pay coins for them, and quick merges in a row pay a little more. Coins
 * open the blanket's locked tiles, buy a bigger basket (batches come out a step ahead more often)
 * and a hotter stove (the steamer makes batches by itself sooner), and later golden batches, each a
 * friend two below the furthest met. Pure rules: the strip that shows them is
 * components/MochiStrip.tsx.
 */

export const COLS = 8;
export const ROWS = 2;
export const SPOTS = COLS * ROWS;

/** The friends, in the order two of each make the next. */
export const FRIENDS = [
  { name: "Dewdrop", many: "dewdrops", note: "Fresh from the steamer." },
  { name: "Mochi", many: "mochi", note: "Soft and round." },
  { name: "Sakura mochi", many: "sakura mochi", note: "Wears a leaf for spring." },
  { name: "Matcha mochi", many: "matcha mochi", note: "A sprout on top." },
  { name: "Chick", many: "chicks", note: "Peeps when you hold it." },
  { name: "Bunny", many: "bunnies", note: "All ears. A third guest comes to the picnic." },
  { name: "Kitty", many: "kitties", note: "Naps in any sunny spot." },
  { name: "Bear", many: "bears", note: "A hug in a bun." },
  { name: "Panda", many: "pandas", note: "Rare, and very round." },
  { name: "Moon", many: "moons", note: "Two moons rise to the sky as a star." },
] as const;
export const TOP = FRIENDS.length - 1;

/** Tiles locked at the start (the two right-hand columns), opened with coins in any order. */
export const LOCKED_AT_START = [6, 7, 14, 15];
/** What each tile opened costs, the first to the last. */
export const UNLOCK_COSTS = [20, 60, 150, 400];

export type Upgrade = "basket" | "stove";
export const MAX_LEVEL = 3;
/** The chance of each friend from the dewdrop up in a batch, by the basket's level. */
export const BASKET_ODDS = [[0.85, 0.15], [0.7, 0.3], [0.55, 0.35, 0.1]];
/** Seconds between the batches the steamer makes by itself, by the stove's level. */
export const STOVE_GAPS = [8, 6, 4];
/** What raising each from level 1 to 2, and from 2 to 3, costs. */
export const UPGRADE_COSTS: Record<Upgrade, number[]> = { basket: [80, 320], stove: [50, 200] };

/** Order cards: up to three guests, the third once a bunny has been met. */
export const ORDER_SLOTS = 3;
export const THIRD_GUEST = 5;
/** Seconds before a guest comes to an empty place, and after one is sent away. */
export const ORDER_GAP = 20;
export const TURN_AWAY_GAP = 25;
/** Seconds between merges that keep a combo going, and the most a merge in one pays. */
export const COMBO_GAP = 3;
export const MAX_COMBO_BONUS = 5;
/** Coins for two moons risen, besides the star. */
export const MOON_COINS = 200;

const GUESTS = ["Hedgehog", "Owl", "Fox", "Badger", "Mole", "Heron", "Squirrel", "Otter", "Wren", "Hare"];
const MEALS = ["tea", "supper", "picnic", "birthday", "lunch", "party", "snack", "feast"];

export interface Order {
  /** Whose order it is, as "Owl's supper". */
  from: string;
  /** The friends asked for, earliest first, and which of them have been handed over. */
  want: number[];
  got: boolean[];
  coins: number;
}

export interface Patch {
  /** Each tile of the blanket: the friend sitting there (its place in FRIENDS), or nothing. */
  spots: (number | null)[];
  /** Tiles not yet opened: nothing sits on them. */
  locked: boolean[];
  /** The furthest friend made so far: every one up to it has been met. */
  best: number;
  /** Moons risen to the sky. */
  stars: number;
  coins: number;
  basket: number;
  stove: number;
  orders: (Order | null)[];
  /** Seconds until a guest comes to each empty place. */
  due: number[];
  /** Merges in the combo running now. */
  combo: number;
  seed: number;
}

export type Outcome =
  | { kind: "none" }
  | { kind: "move"; to: number }
  | { kind: "swap"; to: number }
  | { kind: "merge"; to: number; friend: number; fresh: boolean; combo: number; bonus: number }
  | { kind: "rise"; to: number; combo: number; bonus: number };

/** A seeded draw in [0, 1) and the seed after it. */
function roll(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), next | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

const unfilled = (o: Order) => o.want.filter((_, k) => !o.got[k]);

/** A new order sized to the friends met: one friend early on, up to three later, never a moon. */
export function makeOrder(p: Patch): { order: Order; seed: number } {
  let seed = p.seed;
  const draw = () => {
    const [r, next] = roll(seed);
    seed = next;
    return r;
  };
  const hi = Math.max(1, Math.min(p.best - 2, TOP - 1));
  const lo = Math.max(1, hi - 2);
  const lines = p.best <= 2 ? 1 : p.best <= 5 ? 1 + (draw() < 0.5 ? 1 : 0) : 2 + (draw() < 0.4 ? 1 : 0);
  const want = Array.from({ length: lines }, () => lo + Math.floor(draw() ** 1.5 * (hi - lo + 1))).sort((a, b) => a - b);
  const from = `${GUESTS[Math.floor(draw() * GUESTS.length)]}'s ${MEALS[Math.floor(draw() * MEALS.length)]}`;
  const coins = want.reduce((sum, t) => sum + 3 * 2 ** t, 0) + 5 * (lines - 1);
  return { order: { from, want, got: want.map(() => false), coins }, seed };
}

/** A new blanket: two dewdrops to press together, a mochi waiting for its pair, and one guest. */
export function start(): Patch {
  const spots: (number | null)[] = new Array(SPOTS).fill(null);
  spots[1] = 0;
  spots[3] = 0;
  spots[10] = 1;
  const p: Patch = {
    spots,
    locked: spots.map((_, i) => LOCKED_AT_START.includes(i)),
    best: 1,
    stars: 0,
    coins: 0,
    basket: 1,
    stove: 1,
    orders: new Array(ORDER_SLOTS).fill(null),
    due: new Array(ORDER_SLOTS).fill(ORDER_GAP),
    combo: 0,
    seed: 20261102,
  };
  const { order, seed } = makeOrder(p);
  p.orders[0] = order;
  p.due[0] = 0;
  return { ...p, seed };
}

export const empties = (p: Patch): number[] => p.spots.flatMap((s, i) => (s === null && !p.locked[i] ? [i] : []));
export const capacity = (p: Patch): number => (p.best >= THIRD_GUEST ? 3 : 2);
export const stoveGap = (p: Patch): number => STOVE_GAPS[p.stove - 1];
export const unlockCost = (p: Patch): number | undefined => UNLOCK_COSTS[LOCKED_AT_START.length - p.locked.filter(Boolean).length];
export const upgradeCost = (p: Patch, what: Upgrade): number | undefined => UPGRADE_COSTS[what][p[what] - 1];

/** The steamer's batch, set on an empty tile at random; no tile is taken when the blanket is full. */
export function steam(p: Patch): { patch: Patch; at?: number } {
  const open = empties(p);
  if (!open.length) return { patch: p };
  const [where, s1] = roll(p.seed);
  const [luck, seed] = roll(s1);
  const at = open[Math.floor(where * open.length)];
  const odds = BASKET_ODDS[p.basket - 1];
  let friend = 0;
  for (let sum = odds[0]; friend < odds.length - 1 && luck >= sum; sum += odds[friend]) friend++;
  const spots = p.spots.slice();
  spots[at] = friend;
  return { patch: { ...p, spots, best: Math.max(p.best, friend), seed }, at };
}

/**
 * The friend on `from` pressed onto `to`: two alike make the next friend on `to` (two moons rise
 * and leave both tiles empty), onto an empty tile it moves, and onto another friend they swap. A
 * merge `chained` to the one before it, within COMBO_GAP seconds, carries the combo on and pays a
 * coin for each merge before it in the combo, up to MAX_COMBO_BONUS.
 */
export function press(p: Patch, from: number, to: number, chained = false): { patch: Patch; outcome: Outcome } {
  const a = p.spots[from];
  const b = p.spots[to];
  if (from === to || a === null || a === undefined || b === undefined || p.locked[to]) return { patch: p, outcome: { kind: "none" } };
  const spots = p.spots.slice();
  spots[from] = null;
  if (b === null) {
    spots[to] = a;
    return { patch: { ...p, spots }, outcome: { kind: "move", to } };
  }
  if (b !== a) {
    spots[from] = b;
    spots[to] = a;
    return { patch: { ...p, spots }, outcome: { kind: "swap", to } };
  }
  const combo = chained ? p.combo + 1 : 1;
  const bonus = Math.min(MAX_COMBO_BONUS, combo - 1);
  if (a === TOP) {
    spots[to] = null;
    return { patch: { ...p, spots, combo, stars: p.stars + 1, coins: p.coins + MOON_COINS + bonus }, outcome: { kind: "rise", to, combo, bonus } };
  }
  spots[to] = a + 1;
  return {
    patch: { ...p, spots, combo, coins: p.coins + bonus, best: Math.max(p.best, a + 1) },
    outcome: { kind: "merge", to, friend: a + 1, fresh: a + 1 > p.best, combo, bonus },
  };
}

/** A filled order pays and leaves, and its place waits for the next guest. */
function settle(p: Patch, slot: number): { patch: Patch; paid: number } {
  const o = p.orders[slot]!;
  if (o.got.some((g) => !g)) return { patch: p, paid: 0 };
  const orders = p.orders.slice();
  const due = p.due.slice();
  orders[slot] = null;
  due[slot] = ORDER_GAP;
  return { patch: { ...p, orders, due, coins: p.coins + o.coins }, paid: o.coins };
}

/** The friend on `spot` handed to the guest in `slot`, if the guest still wants one like it. */
export function give(p: Patch, spot: number, slot: number): { patch: Patch; gave: boolean; paid: number } {
  const o = p.orders[slot];
  const f = p.spots[spot];
  const line = o && f !== null && f !== undefined ? o.want.findIndex((w, k) => w === f && !o.got[k]) : -1;
  if (!o || line < 0) return { patch: p, gave: false, paid: 0 };
  const spots = p.spots.slice();
  spots[spot] = null;
  const orders = p.orders.slice();
  orders[slot] = { ...o, got: o.got.map((g, k) => g || k === line) };
  return { ...settle({ ...p, spots, orders }, slot), gave: true };
}

/** Every friend the guest in `slot` still wants that sits on the blanket, handed over at once. */
export function serve(p: Patch, slot: number): { patch: Patch; spots: number[]; paid: number } {
  let patch = p;
  const used: number[] = [];
  let paid = 0;
  for (const want of p.orders[slot] ? unfilled(p.orders[slot]!) : []) {
    const spot = patch.spots.findIndex((f) => f === want);
    if (spot < 0) continue;
    const r = give(patch, spot, slot);
    patch = r.patch;
    paid += r.paid;
    used.push(spot);
  }
  return { patch, spots: used, paid };
}

/** Whether the blanket holds everything the guest in `slot` still wants. */
export function ready(p: Patch, slot: number): boolean {
  const o = p.orders[slot];
  if (!o) return false;
  const left = p.spots.slice();
  return unfilled(o).every((w) => {
    const at = left.indexOf(w);
    if (at < 0) return false;
    left[at] = null;
    return true;
  });
}

/** The guest in `slot` sent away; another comes a little later. */
export function turnAway(p: Patch, slot: number): Patch {
  if (!p.orders[slot]) return p;
  const orders = p.orders.slice();
  const due = p.due.slice();
  orders[slot] = null;
  due[slot] = TURN_AWAY_GAP;
  return { ...p, orders, due };
}

/** Guests come to the empty places the picnic has room for. */
export function tick(p: Patch, dt: number): Patch {
  let patch = p;
  for (let s = 0; s < capacity(p); s++) {
    if (patch.orders[s]) continue;
    const due = patch.due.slice();
    due[s] = Math.max(0, due[s] - dt);
    patch = { ...patch, due };
    if (due[s] > 0) continue;
    const { order, seed } = makeOrder(patch);
    const orders = patch.orders.slice();
    orders[s] = order;
    patch = { ...patch, orders, seed };
  }
  return patch;
}

/** The friend a golden batch brings, two below the furthest met, and what it costs. */
export const goldenFriend = (p: Patch): number => Math.max(1, p.best - 2);
export const goldenCost = (p: Patch): number => 6 * 2 ** goldenFriend(p);

/** A golden batch bought from the steamer, on an empty tile at random, if there is room and coins. */
export function buyGolden(p: Patch): { patch: Patch; at?: number } {
  if (p.coins < goldenCost(p)) return { patch: p };
  const { patch, at } = place(p, goldenFriend(p));
  return at === undefined ? { patch: p } : { patch: { ...patch, coins: p.coins - goldenCost(p) }, at };
}

/** A friend set on an empty tile at random (meeting it, if it is new), when there is room. */
export function place(p: Patch, friend: number): { patch: Patch; at?: number } {
  const open = empties(p);
  if (!open.length) return { patch: p };
  const [where, seed] = roll(p.seed);
  const at = open[Math.floor(where * open.length)];
  const spots = p.spots.slice();
  spots[at] = friend;
  return { patch: { ...p, spots, best: Math.max(p.best, friend), seed }, at };
}

/** A locked tile opened, if the coins are there. */
export function unlock(p: Patch, spot: number): Patch {
  const cost = unlockCost(p);
  if (!p.locked[spot] || cost === undefined || p.coins < cost) return p;
  return { ...p, coins: p.coins - cost, locked: p.locked.map((l, i) => l && i !== spot) };
}

/** The basket or the stove raised a level, if the coins are there. */
export function upgrade(p: Patch, what: Upgrade): Patch {
  const cost = upgradeCost(p, what);
  if (cost === undefined || p.coins < cost) return p;
  return { ...p, coins: p.coins - cost, [what]: p[what] + 1 };
}

/** Two alike to point out to a player who has stopped, the earliest friends first. */
export function pair(p: Patch): [number, number] | undefined {
  for (let f = 0; f <= TOP; f++) {
    const at = p.spots.flatMap((s, i) => (s === f ? [i] : []));
    if (at.length >= 2) return [at[0], at[1]];
  }
  return undefined;
}

const isFriend = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= TOP;
const isCount = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;
const isLevel = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 1 && (x as number) <= MAX_LEVEL;

function reviveOrder(x: unknown): Order | null {
  const o = x as Partial<Order> | null | undefined;
  if (!o || typeof o.from !== "string" || !Array.isArray(o.want) || !o.want.length || o.want.length > 3 || !o.want.every(isFriend)) return null;
  if (!Array.isArray(o.got) || o.got.length !== o.want.length || !isCount(o.coins)) return null;
  return { from: o.from, want: o.want, got: o.got.map(Boolean), coins: o.coins };
}

/**
 * A saved blanket, checked; anything unreadable starts afresh. A blanket saved before coins and
 * guests keeps all its tiles open and gets its first guest now.
 */
export function revive(x: unknown): Patch {
  const s = x as Partial<Patch> | null | undefined;
  if (!s || !Array.isArray(s.spots) || s.spots.length !== SPOTS) return start();
  const locked = Array.isArray(s.locked) && s.locked.length === SPOTS ? s.locked.map((l, i) => Boolean(l) && LOCKED_AT_START.includes(i)) : new Array(SPOTS).fill(false);
  const spots = s.spots.map((f, i) => (isFriend(f) && !locked[i] ? f : null));
  const best = Math.max(isFriend(s.best) ? s.best : 0, ...spots.map((f) => f ?? 0));
  const orders = Array.from({ length: ORDER_SLOTS }, (_, k) => (Array.isArray(s.orders) ? reviveOrder(s.orders[k]) : null));
  const due = Array.from({ length: ORDER_SLOTS }, (_, k) => {
    const d = Array.isArray(s.due) ? s.due[k] : undefined;
    return typeof d === "number" && d >= 0 && d <= TURN_AWAY_GAP ? d : Array.isArray(s.orders) ? ORDER_GAP : 0;
  });
  return {
    spots,
    locked,
    best,
    stars: isCount(s.stars) ? s.stars : 0,
    coins: isCount(s.coins) ? s.coins : 0,
    basket: isLevel(s.basket) ? s.basket : 1,
    stove: isLevel(s.stove) ? s.stove : 1,
    orders,
    due,
    combo: 0,
    seed: Number.isInteger(s.seed) ? (s.seed as number) : 20261102,
  };
}
