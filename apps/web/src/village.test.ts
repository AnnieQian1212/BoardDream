import { describe, expect, test } from "vitest";
import {
  AWAY_CAP,
  boosted,
  build,
  capacity,
  CART_GAP,
  catchUp,
  clearCost,
  clearWild,
  costOf,
  CROPS,
  deliver,
  demolish,
  eraOf,
  makeOrder,
  MAX_LEVEL,
  PLOTS,
  promised,
  raise,
  raiseCost,
  revive,
  sell,
  start,
  tap,
  tick,
  turnAway,
  villagers,
  type Plot,
  type Village,
} from "./village";

/** A village with these plots (padded with open land), rich enough to build, with no cart waiting. */
const town = (plots: Plot[], extra: Partial<Village> = {}): Village => ({
  ...start(),
  plots: [...plots, ...new Array(PLOTS - plots.length).fill(null)],
  progress: new Array(PLOTS).fill(0),
  orders: [null, null, null],
  due: [CART_GAP, CART_GAP, CART_GAP],
  coins: 10_000,
  ...extra,
});
const ripe = (v: Village, ...plots: number[]): Village => ({ ...v, progress: v.progress.map((g, i) => (plots.includes(i) ? 1 : g)) });

describe("the hamlet", () => {
  test("starts as a hamlet: two fields, a cottage, open land, wild land and a cart waiting for wheat", () => {
    const v = start();
    expect(v.plots).toHaveLength(PLOTS);
    expect(v.plots.slice(0, 5)).toEqual(["field", "cottage", "field", null, null]);
    expect(v.plots.filter((p) => p === "wild")).toHaveLength(7);
    expect(eraOf(v)).toBe("Hamlet");
    expect(v.orders[0]?.want).toEqual({ wheat: expect.any(Number) });
    expect(v.orders.slice(1)).toEqual([null, null]);
  });

  test("a click tends a green crop, and harvests a ripe one", () => {
    const v = town(["field", "orchard"]);
    let { village, made } = tap(v, 0);
    expect(made).toBeUndefined();
    expect(village.progress[0]).toBeCloseTo(0.2);
    ({ village, made } = tap(ripe(village, 0, 1), 0));
    expect(made).toEqual({ plot: 0, good: "wheat", n: 3 });
    expect(village.progress[0]).toBe(0);
    ({ village } = tap(village, 1));
    expect(village.stock).toMatchObject({ wheat: 3, apples: 4 });
  });

  test("crops ripen in time by themselves, half again as fast beside a well", () => {
    const v = town(["field", null, "field", "well"]);
    const half = CROPS.field.seconds / 2;
    const { village } = tick(v, half);
    expect(village.progress[0]).toBeCloseTo(0.5);
    expect(village.progress[2]).toBeCloseTo(0.75);
    expect(boosted(v, 2)).toBe(true);
    expect(boosted(v, 0)).toBe(false);
  });

  test("villagers bring in ripe crops, faster from a cottage beside a garden, and wait when none are ripe", () => {
    const plain = ripe(town(["field", "field", "field", "cottage"]), 0, 1, 2);
    expect(tick(plain, 7).made.map((m) => m.plot)).toEqual([0]);
    const cheered = ripe(town(["field", "field", "field", "cottage", "garden"]), 0, 1, 2);
    expect(tick(cheered, 7).made.map((m) => m.plot)).toEqual([0, 1]);
    const idle = tick(town(["field", "cottage"]), 2.9);
    expect(idle.made).toEqual([]);
    expect(idle.village.work).toBe(0);
    // A crop that ripens is left a while for the player to pick.
    const justRipe = tick(ripe(town(["field", "cottage"]), 0), 4);
    expect(justRipe.made).toEqual([]);
  });

  test("a windmill grinds wheat into flour, twice as fast beside a field, and waits for wheat", () => {
    const v = town(["mill", null, "field", "mill"], { stock: { wheat: 4, apples: 0, flour: 0, bread: 0, cider: 0 } });
    const { village, made } = tick(v, 4);
    expect(made.filter((m) => m.good === "flour").map((m) => m.plot)).toEqual([0, 3, 3]);
    expect(village.stock.flour).toBe(3);
    expect(tick(village, 4).village.stock).toMatchObject({ wheat: 0, flour: 4 });
    const dry = tick(town(["mill"]), 10);
    expect(dry.village.progress[0]).toBe(0);
  });

  test("a bakery bakes flour into bread and a press turns apples into cider", () => {
    const v = town(["mill", "bakery", null, "orchard", "press"], { stock: { wheat: 0, apples: 3, flour: 2, bread: 0, cider: 0 } });
    const { village } = tick(v, 4);
    expect(village.stock).toMatchObject({ flour: 0, bread: 1, apples: 0, cider: 1 });
  });

  test("workshops leave alone what a waiting cart has asked for", () => {
    const order = { from: "Fernbrook", want: { wheat: 4, flour: 1 }, coins: 20, stars: 1 };
    const v = town(["mill"], { stock: { wheat: 6, apples: 0, flour: 0, bread: 0, cider: 0 }, orders: [order, null, null] });
    expect(promised(v)).toMatchObject({ wheat: 4, flour: 1 });
    const later = tick(v, 60).village;
    expect(later.stock).toMatchObject({ wheat: 4, flour: 2 });
    expect(deliver(later, 0).stock).toMatchObject({ wheat: 0, flour: 1 });
  });

  test("filling an order pays coins and stars, and the next cart comes a little later", () => {
    const v = start();
    const order = v.orders[0]!;
    expect(deliver(v, 0)).toBe(v);
    const stocked = { ...v, stock: { ...v.stock, wheat: 50 } };
    const filled = deliver(stocked, 0);
    expect(filled.coins).toBe(order.coins);
    expect(filled.stars).toBe(order.stars);
    expect(filled.stock.wheat).toBe(50 - order.want.wheat!);
    expect(filled.orders[0]).toBeNull();
    expect(tick(filled, CART_GAP - 1).village.orders[0]).toBeNull();
    expect(tick(filled, CART_GAP).village.orders[0]).not.toBeNull();
  });

  test("a turned-away cart leaves, and is replaced later", () => {
    const away = turnAway(start(), 0);
    expect(away.orders[0]).toBeNull();
    expect(away.stars).toBe(0);
    expect(tick(away, CART_GAP).village.orders[0]).toBeNull();
  });

  test("stars grow the town, which opens a second order slot, and a trading post a third", () => {
    expect(eraOf({ ...start(), stars: 3 })).toBe("Hamlet");
    expect(eraOf({ ...start(), stars: 4 })).toBe("Village");
    expect(eraOf({ ...start(), stars: 14 })).toBe("Market town");
    expect(eraOf({ ...start(), stars: 40 })).toBe("Trade town");
    expect(capacity(start())).toBe(1);
    expect(capacity({ ...start(), stars: 4 })).toBe(2);
    expect(capacity(town(["post", "post"], { stars: 14 }))).toBe(3);
    const grown = tick({ ...start(), stars: 4 }, 0.1).village;
    expect(grown.orders.filter(Boolean)).toHaveLength(2);
  });

  test("buildings cost coins, more each time, only on open land, and only once the town is big enough", () => {
    const v = town(["field"], { coins: 100 });
    expect(build(v, 0, "field")).toBe(v);
    const one = build(v, 1, "field");
    expect(one.coins).toBe(100 - costOf(v, "field"));
    expect(costOf(one, "field")).toBeGreaterThan(costOf(v, "field"));
    expect(build(v, 1, "orchard")).toBe(v);
    expect(build({ ...v, stars: 4 }, 1, "orchard").plots[1]).toBe("orchard");
    expect(build({ ...v, coins: 0 }, 1, "field").plots[1]).toBeNull();
  });

  test("crops, cottages and workshops go up two levels, each level as much again", () => {
    const v = ripe(town(["field", "cottage", "mill", "well"], { coins: 1000 }), 0);
    expect(raiseCost(v, 3)).toBeUndefined();
    const up = raise(raise(raise(v, 0), 1), 2);
    expect(up.levels.slice(0, 3)).toEqual([2, 2, 2]);
    expect(up.coins).toBe(1000 - raiseCost(v, 0)! - raiseCost(v, 1)! - raiseCost(v, 2)!);
    expect(tap(up, 0).made?.n).toBe(6);
    expect(villagers(up)).toBe(4);
    const top = raise(up, 0);
    expect(top.levels[0]).toBe(MAX_LEVEL);
    expect(raiseCost(top, 0)).toBeUndefined();
    expect(raise(top, 0)).toBe(top);
    expect(raiseCost(up, 0)).toBeGreaterThan(raiseCost(v, 0)!);
    const ground = tick({ ...up, stock: { ...up.stock, wheat: 4 } }, 4).village;
    expect(ground.stock.flour).toBe(2);
    expect(demolish(up, 0).levels[0]).toBe(1);
  });

  test("wild land is cleared for coins, each plot dearer, and a building can be pulled down", () => {
    const v = { ...start(), coins: 1000 };
    const once = clearWild(v, 5);
    expect(once.plots[5]).toBeNull();
    expect(once.coins).toBe(1000 - clearCost(v));
    expect(clearCost(once)).toBeGreaterThan(clearCost(v));
    expect(clearWild(v, 3)).toBe(v);
    expect(demolish(v, 1).plots[1]).toBeNull();
    expect(demolish(v, 5)).toBe(v);
  });

  test("spare goods sell at the market for less than a cart pays, and the carts' share stays", () => {
    const v = { ...start(), stock: { ...start().stock, wheat: 30 } };
    const order = v.orders[0]!;
    const sold = sell(v, "wheat");
    expect(sold.stock.wheat).toBe(order.want.wheat);
    expect(sold.coins).toBe(30 - order.want.wheat!);
    expect(order.coins).toBeGreaterThan(order.want.wheat!);
    expect(sell(town([]), "apples")).toEqual(town([]));
  });

  test("carts only ask for goods the town can make, in amounts sized to what makes them", () => {
    const fields = town(["field", "cottage"], { stars: 40 });
    for (let seed = 1; seed < 40; seed++) expect(Object.keys(makeOrder({ ...fields, seed }).order.want)).toEqual(["wheat"]);
    const all = town(["field", "orchard", "mill", "bakery", "press"], { stars: 40 });
    const asked = new Set<string>();
    let lines = 0;
    for (let seed = 1; seed < 60; seed++) {
      const { order } = makeOrder({ ...all, seed });
      Object.keys(order.want).forEach((g) => asked.add(g));
      lines = Math.max(lines, Object.keys(order.want).length);
      expect(order.stars).toBe("bread" in order.want || "cider" in order.want ? 2 : 1);
    }
    expect(asked).toEqual(new Set(["wheat", "apples", "flour", "bread", "cider"]));
    expect(lines).toBe(3);
    const small = makeOrder({ ...town(["field"]), seed: 7 }).order.want.wheat!;
    const big = makeOrder({ ...town(["field", "field", "field"]), seed: 7 }).order.want.wheat!;
    expect(big).toBeGreaterThan(2 * small);
  });

  test("time away is caught up, but no more than half an hour", () => {
    const back = catchUp(start(), 10 * 3600);
    const wheat = back.stock.wheat;
    expect(wheat).toBeGreaterThan(0);
    // Two fields at most, a harvest of three each per ripening.
    expect(wheat).toBeLessThanOrEqual(2 * 3 * (AWAY_CAP / CROPS.field.seconds + 1));
  });

  test("a saved village is revived whole, whatever was stored", () => {
    expect(revive(null)).toEqual(start());
    const odd = revive({ coins: 12.9, plots: new Array(PLOTS).fill("castle"), progress: [5], orders: [{ from: 3 }], stock: { wheat: -2, bread: 4 } });
    expect(odd.coins).toBe(12);
    expect(odd.plots.every((p) => p === null)).toBe(true);
    expect(odd.orders).toEqual([null, null, null]);
    expect(odd.stock).toEqual({ wheat: 0, apples: 0, flour: 0, bread: 4, cider: 0 });
    expect(revive({ plots: ["field", "well", ...new Array(10).fill(null)], levels: [9, 3] }).levels.slice(0, 2)).toEqual([3, 1]);
  });

  test("a village saved before carts came keeps its land, coins and grain", () => {
    const old = { coins: 243, grain: 18, plots: ["field", "cottage", "mill", "stall", ...new Array(8).fill(null)], growth: [0.5, 0, 0, 0], harvested: 90, work: 0.3, trade: 0.2 };
    const v = revive(old);
    expect(v.coins).toBe(243);
    expect(v.stock.wheat).toBe(18);
    expect(v.plots.slice(0, 4)).toEqual(["field", "cottage", "mill", "post"]);
    expect(v.plots.slice(4).every((p) => p === null)).toBe(true);
    expect(v.progress[0]).toBe(0.5);
    expect(tick(v, 0.1).village.orders[0]).not.toBeNull();
  });
});
