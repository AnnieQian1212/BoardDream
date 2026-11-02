import { describe, expect, test } from "vitest";
import { build, catchUp, costOf, eraOf, PLOTS, PRICE, revive, RIPEN, sellAll, start, tap, tick, yieldOf } from "./village";

describe("the hamlet", () => {
  test("starts with two fields and a cottage on twelve plots", () => {
    const v = start();
    expect(v.plots).toHaveLength(PLOTS);
    expect(v.plots.filter(Boolean)).toEqual(["field", "cottage", "field"]);
    expect(eraOf(v)).toBe("Hamlet");
  });

  test("a click tends a green field, and harvests a ripe one", () => {
    let { village, gained } = tap(start(), 0);
    expect(gained).toBe(0);
    expect(village.growth[0]).toBeCloseTo(0.2);
    village = { ...village, growth: village.growth.map((g, i) => (i === 0 ? 1 : g)) };
    ({ village, gained } = tap(village, 0));
    expect(gained).toBe(3);
    expect(village.grain).toBe(3);
    expect(village.growth[0]).toBe(0);
  });

  test("fields ripen in time by themselves", () => {
    const empty = { ...start(), plots: start().plots.map((p) => (p === "cottage" ? null : p)) };
    expect(tick(empty, RIPEN / 2).village.growth[0]).toBeCloseTo(0.5);
    expect(tick(empty, RIPEN).village.growth[0]).toBe(1);
  });

  test("a villager harvests ripe fields, one every four seconds, and waits when none are ripe", () => {
    const ripe = { ...start(), growth: start().growth.map((_, i) => (i === 0 || i === 2 ? 1 : 0)) };
    const first = tick(ripe, 4);
    expect(first.harvestedPlots).toEqual([0]);
    expect(first.village.grain).toBe(3);
    const idle = tick({ ...start() }, 12);
    expect(idle.harvestedPlots).toEqual([]);
    expect(idle.village.work).toBeLessThanOrEqual(1);
  });

  test("grain sells for coins, by hand or at a stall", () => {
    const rich = { ...start(), grain: 5 };
    expect(sellAll(rich).coins).toBe(5 * PRICE);
    const withStall = { ...rich, coins: 1000 };
    const built = build(withStall, 5, "stall");
    expect(built.plots[5]).toBe("stall");
    const { village } = tick(built, 2);
    expect(village.grain).toBe(3);
    expect(village.coins).toBe(built.coins + 2 * PRICE);
  });

  test("buildings cost coins, more each time, and only on an empty plot", () => {
    const v = { ...start(), coins: 100 };
    expect(build(start(), 5, "field")).toEqual(start());
    expect(build(v, 0, "field")).toBe(v);
    const one = build(v, 5, "field");
    expect(one.coins).toBe(100 - costOf(v, "field"));
    expect(costOf(one, "field")).toBeGreaterThan(costOf(v, "field"));
  });

  test("windmills make harvests bigger", () => {
    const v = { ...start(), coins: 1000 };
    expect(yieldOf(build(build(v, 5, "mill"), 6, "mill"))).toBe(6);
  });

  test("time away is caught up, but no more than half an hour", () => {
    const back = catchUp(start(), 10 * 3600);
    expect(back.harvested).toBeGreaterThan(0);
    expect(back.harvested).toBeLessThanOrEqual(30 * 60 / 4 * 3);
  });

  test("the town is named by how much land is built", () => {
    const plots = start().plots.map((_, i) => (i < 9 ? "cottage" : null)) as ReturnType<typeof start>["plots"];
    expect(eraOf({ ...start(), plots })).toBe("Market town");
  });

  test("a saved village is revived whole, whatever was stored", () => {
    expect(revive(null)).toEqual(start());
    const odd = revive({ coins: 12.9, plots: new Array(PLOTS).fill("castle"), growth: [5] });
    expect(odd.coins).toBe(12);
    expect(odd.plots.every((p) => p === null)).toBe(true);
  });
});
