import { describe, expect, it } from "vitest";
import {
  BASKET_ODDS,
  buyGolden,
  capacity,
  empties,
  FRIENDS,
  give,
  goldenCost,
  goldenFriend,
  LOCKED_AT_START,
  makeOrder,
  MAX_COMBO_BONUS,
  MOON_COINS,
  ORDER_GAP,
  pair,
  place,
  press,
  ready,
  revive,
  serve,
  SPOTS,
  start,
  steam,
  stoveGap,
  tick,
  TOP,
  turnAway,
  TURN_AWAY_GAP,
  unlock,
  unlockCost,
  upgrade,
  upgradeCost,
  type Order,
  type Patch,
} from "./mochi";

/** A blanket with these friends from the first tile on, the rest empty and all open, no guests. */
const blanket = (friends: (number | null)[], extra: Partial<Patch> = {}): Patch => ({
  ...start(),
  spots: [...friends, ...new Array(SPOTS - friends.length).fill(null)],
  locked: new Array(SPOTS).fill(false),
  orders: [null, null, null],
  due: [ORDER_GAP, ORDER_GAP, ORDER_GAP],
  ...extra,
});
const order = (want: number[], coins = 10): Order => ({ from: "Owl's supper", want, got: want.map(() => false), coins });

describe("the mochi steamer", () => {
  it("starts with a pair of dewdrops, four locked tiles and one guest", () => {
    const p = start();
    expect(p.spots).toHaveLength(SPOTS);
    expect(pair(p)).toEqual([1, 3]);
    expect(p.locked.flatMap((l, i) => (l ? [i] : []))).toEqual(LOCKED_AT_START);
    expect(empties(p)).toHaveLength(SPOTS - 3 - LOCKED_AT_START.length);
    expect(p.orders[0]).toMatchObject({ want: [1], coins: 6 });
    expect(p.orders.slice(1)).toEqual([null, null]);
    expect(capacity(p)).toBe(2);
  });

  it("steams onto open empty tiles only, and a full blanket takes no more", () => {
    let p = { ...start(), spots: new Array(SPOTS).fill(null) };
    for (let i = 0; i < SPOTS - LOCKED_AT_START.length; i++) {
      const { patch, at } = steam(p);
      expect(at).toBeDefined();
      expect(p.locked[at!]).toBe(false);
      expect(p.spots[at!]).toBeNull();
      p = patch;
    }
    expect(empties(p)).toEqual([]);
    expect(steam(p)).toEqual({ patch: p });
  });

  it("comes out a step ahead more often from a bigger basket", () => {
    for (const basket of [1, 2, 3]) {
      let p = blanket([], { basket });
      const seen = [0, 0, 0];
      for (let i = 0; i < 3000; i++) {
        const { patch, at } = steam(p);
        seen[patch.spots[at!]!]++;
        p = { ...patch, spots: new Array(SPOTS).fill(null) };
      }
      BASKET_ODDS[basket - 1].forEach((chance, f) => expect(Math.abs(seen[f] / 3000 - chance)).toBeLessThan(0.03));
      if (basket < 3) expect(seen[2]).toBe(0);
    }
  });

  it("makes the next friend from two alike, and says when it is a new one", () => {
    const p = blanket([2, null, 2], { best: 2 });
    const { patch, outcome } = press(p, 0, 2);
    expect(patch.spots.slice(0, 3)).toEqual([null, null, 3]);
    expect(outcome).toEqual({ kind: "merge", to: 2, friend: 3, fresh: true, combo: 1, bonus: 0 });
    expect(patch.best).toBe(3);
    const again = press(blanket([2, 2], { best: 5 }), 1, 0);
    expect(again.outcome).toMatchObject({ kind: "merge", friend: 3, fresh: false });
    expect(again.patch.best).toBe(5);
  });

  it("pays a coin more for each merge in a combo, up to a cap", () => {
    let p = blanket([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
    const bonuses: number[] = [];
    for (let k = 0; k < 8; k++) {
      const r = press(p, 2 * k, 2 * k + 1, k > 0);
      bonuses.push((r.outcome as { bonus: number }).bonus);
      p = r.patch;
    }
    expect(bonuses).toEqual([0, 1, 2, 3, 4, 5, 5, 5].map((b) => Math.min(b, MAX_COMBO_BONUS)));
    expect(p.coins).toBe(25);
    // A merge that is not chained starts a new combo.
    expect(press(blanket([0, 0], { combo: 6 }), 0, 1).outcome).toMatchObject({ combo: 1, bonus: 0 });
  });

  it("raises two moons to the sky as a star, with coins", () => {
    const { patch, outcome } = press(blanket([TOP, TOP], { best: TOP }), 0, 1);
    expect(outcome).toEqual({ kind: "rise", to: 1, combo: 1, bonus: 0 });
    expect(patch.spots.slice(0, 2)).toEqual([null, null]);
    expect(patch.stars).toBe(1);
    expect(patch.coins).toBe(MOON_COINS);
  });

  it("moves onto an empty tile and swaps with a different friend, but never onto a locked one", () => {
    const moved = press(blanket([4, null, 6]), 0, 1);
    expect(moved.outcome).toEqual({ kind: "move", to: 1 });
    expect(moved.patch.spots.slice(0, 3)).toEqual([null, 4, 6]);
    const swapped = press(blanket([4, null, 6]), 0, 2);
    expect(swapped.outcome).toEqual({ kind: "swap", to: 2 });
    expect(swapped.patch.spots.slice(0, 3)).toEqual([6, null, 4]);
    const locked = blanket([4], { locked: LOCKED_AT_START.reduce((l, i) => ((l[i] = true), l), new Array(SPOTS).fill(false)) });
    expect(press(locked, 0, LOCKED_AT_START[0]).outcome.kind).toBe("none");
  });

  it("does nothing from an empty tile, onto itself or off the blanket", () => {
    const p = blanket([1, null]);
    expect(press(p, 1, 0).outcome.kind).toBe("none");
    expect(press(p, 0, 0).outcome.kind).toBe("none");
    expect(press(p, 0, SPOTS).outcome.kind).toBe("none");
    expect(press(p, 1, 0).patch).toBe(p);
  });

  it("hands a guest the friends it asks for, and pays when the order is filled", () => {
    let p = blanket([3, 5, 3], { orders: [order([3, 5], 50), null, null], coins: 7 });
    let r = give(p, 1, 0);
    expect(r).toMatchObject({ gave: true, paid: 0 });
    expect(r.patch.spots.slice(0, 3)).toEqual([3, null, 3]);
    expect(r.patch.orders[0]!.got).toEqual([false, true]);
    p = r.patch;
    // Not one it still wants, or from an empty tile.
    expect(give(p, 1, 0).gave).toBe(false);
    expect(give(blanket([4], { orders: p.orders }), 0, 0).gave).toBe(false);
    r = give(p, 2, 0);
    expect(r).toMatchObject({ gave: true, paid: 50 });
    expect(r.patch.coins).toBe(57);
    expect(r.patch.orders[0]).toBeNull();
    expect(r.patch.due[0]).toBe(ORDER_GAP);
    expect(r.patch.spots.slice(0, 3)).toEqual([3, null, null]);
  });

  it("serves a guest everything it wants that sits on the blanket, and says when it can", () => {
    const p = blanket([2, 4, 2, 6], { orders: [order([2, 2, 4], 30), order([6, 7]), null] });
    expect(ready(p, 0)).toBe(true);
    expect(ready(p, 1)).toBe(false);
    expect(ready(blanket([2, 4], { orders: p.orders }), 0)).toBe(false);
    const all = serve(p, 0);
    expect(all.spots.sort()).toEqual([0, 1, 2]);
    expect(all.paid).toBe(30);
    expect(all.patch.spots.slice(0, 4)).toEqual([null, null, null, 6]);
    const part = serve(p, 1);
    expect(part).toMatchObject({ spots: [3], paid: 0 });
    expect(part.patch.orders[1]!.got).toEqual([true, false]);
  });

  it("brings guests to empty places in time, a third once a bunny is met", () => {
    let p = blanket([], { due: [1, 3, 0] });
    p = tick(p, 1);
    expect(p.orders.map(Boolean)).toEqual([true, false, false]);
    p = tick(p, 2);
    expect(p.orders.map(Boolean)).toEqual([true, true, false]);
    p = tick({ ...p, best: 5 }, 0.25);
    expect(capacity(p)).toBe(3);
    expect(p.orders.map(Boolean)).toEqual([true, true, true]);
    const sent = turnAway(p, 1);
    expect(sent.orders[1]).toBeNull();
    expect(sent.due[1]).toBe(TURN_AWAY_GAP);
  });

  it("sizes orders to the friends met, asking for ones two below the furthest, never a moon", () => {
    for (const best of [1, 2, 4, 6, 9]) {
      let p = blanket([], { best });
      for (let i = 0; i < 200; i++) {
        const { order: o, seed } = makeOrder(p);
        p = { ...p, seed };
        expect(o.want.length).toBeGreaterThanOrEqual(best <= 2 ? 1 : best <= 5 ? 1 : 2);
        expect(o.want.length).toBeLessThanOrEqual(best <= 2 ? 1 : best <= 5 ? 2 : 3);
        for (const w of o.want) {
          expect(w).toBeGreaterThanOrEqual(1);
          expect(w).toBeGreaterThanOrEqual(Math.max(1, best - 4));
          expect(w).toBeLessThanOrEqual(Math.max(1, Math.min(best - 2, TOP - 1)));
        }
        expect(o.coins).toBe(o.want.reduce((s, w) => s + 3 * 2 ** w, 0) + 5 * (o.want.length - 1));
      }
    }
  });

  it("opens locked tiles for coins, each dearer than the last", () => {
    let p = { ...start(), coins: 100 };
    expect(unlockCost(p)).toBe(20);
    expect(unlock(p, 0)).toBe(p);
    p = unlock(p, 15);
    expect(p.locked[15]).toBe(false);
    expect(p.coins).toBe(80);
    expect(unlockCost(p)).toBe(60);
    p = unlock(p, 6);
    expect(p.coins).toBe(20);
    expect(unlock(p, 7)).toBe(p);
    p = unlock(unlock({ ...p, coins: 1000 }, 7), 14);
    expect(p.locked.some(Boolean)).toBe(false);
    expect(unlockCost(p)).toBeUndefined();
  });

  it("raises the basket and the stove for coins, up to the third level", () => {
    let p = { ...start(), coins: 1000 };
    expect(stoveGap(p)).toBe(8);
    p = upgrade(upgrade(p, "stove"), "stove");
    expect(stoveGap(p)).toBe(4);
    expect(p.coins).toBe(750);
    expect(upgradeCost(p, "stove")).toBeUndefined();
    expect(upgrade(p, "stove")).toBe(p);
    p = upgrade(p, "basket");
    expect(p.basket).toBe(2);
    expect(p.coins).toBe(670);
    expect(upgrade({ ...p, coins: 10 }, "basket").basket).toBe(2);
  });

  it("sells a golden batch, two below the furthest friend met, onto an empty tile", () => {
    const p = blanket([7, 7], { best: 7, coins: 200 });
    expect(goldenFriend(p)).toBe(5);
    expect(goldenCost(p)).toBe(192);
    const { patch, at } = buyGolden(p);
    expect(at).toBeGreaterThan(1);
    expect(patch.spots[at!]).toBe(5);
    expect(patch.coins).toBe(8);
    expect(buyGolden(patch)).toEqual({ patch });
    const full = blanket(new Array(SPOTS).fill(0), { coins: 999 });
    expect(buyGolden(full)).toEqual({ patch: full });
    expect(goldenFriend(blanket([], { best: 1 }))).toBe(1);
  });

  it("places a friend on an empty tile, meeting it if it is new", () => {
    const p = blanket([1], { best: 3 });
    const { patch, at } = place(p, 6);
    expect(at).toBeGreaterThan(0);
    expect(patch.spots[at!]).toBe(6);
    expect(patch.best).toBe(6);
    expect(place(patch, 0).patch.best).toBe(6);
    const full = blanket(new Array(SPOTS).fill(0));
    expect(place(full, 2)).toEqual({ patch: full });
  });

  it("points out the earliest pair, or none", () => {
    expect(pair(blanket([5, 3, 5, 3]))).toEqual([1, 3]);
    expect(pair(blanket([0, 1, 2, 3]))).toBeUndefined();
  });

  it("revives a saved blanket and starts afresh from anything unreadable", () => {
    const saved = blanket([3, 7, null], { stars: 2, best: 4, coins: 31, basket: 2, orders: [order([3]), null, null], due: [0, 4, 6] });
    expect(revive(JSON.parse(JSON.stringify(saved)))).toEqual({ ...saved, best: 7, combo: 0 });
    expect(revive(null)).toEqual(start());
    expect(revive({ spots: [1, 2] })).toEqual(start());
    const odd = revive({ spots: [99, -1, 1.5, "x", ...new Array(SPOTS - 4).fill(null)], best: "far", stars: -3, coins: 2.5, stove: 9, orders: [{ from: "x", want: [], got: [] }] });
    expect(odd.spots.every((s) => s === null)).toBe(true);
    expect(odd).toMatchObject({ best: 0, stars: 0, coins: 0, stove: 1, orders: [null, null, null] });
  });

  it("keeps an older blanket's tiles open and sends it a guest", () => {
    const old = { spots: [3, 7, ...new Array(SPOTS - 2).fill(null)], best: 7, stars: 1, seed: 5 };
    let p = revive(old);
    expect(p.locked.some(Boolean)).toBe(false);
    expect(p).toMatchObject({ coins: 0, basket: 1, stove: 1, stars: 1 });
    p = tick(p, 0.25);
    expect(p.orders.filter(Boolean)).toHaveLength(3);
  });

  it("has a name, a plural and a note for every friend", () => {
    expect(FRIENDS).toHaveLength(TOP + 1);
    for (const f of FRIENDS) expect(f.name && f.many && f.note).toBeTruthy();
  });
});
