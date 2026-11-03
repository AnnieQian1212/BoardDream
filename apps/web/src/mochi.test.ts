import { describe, expect, it } from "vitest";
import { empties, FRIENDS, LUCKY, pair, press, revive, SPOTS, start, steam, TOP, type Patch } from "./mochi";

/** A blanket with these friends from the first spot on, the rest empty. */
const blanket = (friends: (number | null)[], extra: Partial<Patch> = {}): Patch => ({
  ...start(),
  spots: [...friends, ...new Array(SPOTS - friends.length).fill(null)],
  ...extra,
});

describe("the mochi steamer", () => {
  it("starts with a pair of dewdrops to press together", () => {
    const p = start();
    expect(p.spots).toHaveLength(SPOTS);
    expect(pair(p)).toEqual([1, 3]);
    expect(p.best).toBe(1);
  });

  it("steams a dewdrop, or now and then a mochi, onto an empty spot", () => {
    let p = blanket([0, 0, 0]);
    const made: number[] = [];
    for (let i = 0; i < SPOTS - 3; i++) {
      const { patch, at } = steam(p);
      expect(at).toBeDefined();
      expect(p.spots[at!]).toBeNull();
      made.push(patch.spots[at!]!);
      p = patch;
    }
    expect(empties(p)).toEqual([]);
    expect(made.every((f) => f === 0 || f === 1)).toBe(true);
    // A full blanket takes no more.
    expect(steam(p)).toEqual({ patch: p });
  });

  it("comes out a mochi about as often as it should", () => {
    let p = blanket([]);
    let lucky = 0;
    for (let i = 0; i < 2000; i++) {
      const { patch, at } = steam(p);
      lucky += patch.spots[at!] === 1 ? 1 : 0;
      p = { ...patch, spots: new Array(SPOTS).fill(null) };
    }
    expect(lucky / 2000).toBeGreaterThan(LUCKY - 0.03);
    expect(lucky / 2000).toBeLessThan(LUCKY + 0.03);
  });

  it("makes the next friend from two alike, and says when it is a new one", () => {
    const p = blanket([2, null, 2], { best: 2 });
    const { patch, outcome } = press(p, 0, 2);
    expect(patch.spots.slice(0, 3)).toEqual([null, null, 3]);
    expect(outcome).toEqual({ kind: "merge", to: 2, friend: 3, fresh: true });
    expect(patch.best).toBe(3);
    const again = press(blanket([2, 2], { best: 5 }), 1, 0);
    expect(again.outcome).toEqual({ kind: "merge", to: 0, friend: 3, fresh: false });
    expect(again.patch.best).toBe(5);
  });

  it("raises two moons to the sky as a star", () => {
    const { patch, outcome } = press(blanket([TOP, TOP], { best: TOP }), 0, 1);
    expect(outcome).toEqual({ kind: "rise", to: 1 });
    expect(patch.spots.slice(0, 2)).toEqual([null, null]);
    expect(patch.stars).toBe(1);
  });

  it("moves onto an empty spot and swaps with a different friend", () => {
    const moved = press(blanket([4, null, 6]), 0, 1);
    expect(moved.outcome).toEqual({ kind: "move", to: 1 });
    expect(moved.patch.spots.slice(0, 3)).toEqual([null, 4, 6]);
    const swapped = press(blanket([4, null, 6]), 0, 2);
    expect(swapped.outcome).toEqual({ kind: "swap", to: 2 });
    expect(swapped.patch.spots.slice(0, 3)).toEqual([6, null, 4]);
  });

  it("does nothing from an empty spot, onto itself or off the blanket", () => {
    const p = blanket([1, null]);
    expect(press(p, 1, 0).outcome.kind).toBe("none");
    expect(press(p, 0, 0).outcome.kind).toBe("none");
    expect(press(p, 0, SPOTS).outcome.kind).toBe("none");
    expect(press(p, 1, 0).patch).toBe(p);
  });

  it("points out the earliest pair, or none", () => {
    expect(pair(blanket([5, 3, 5, 3]))).toEqual([1, 3]);
    expect(pair(blanket([0, 1, 2, 3]))).toBeUndefined();
  });

  it("revives a saved blanket and starts afresh from anything unreadable", () => {
    const saved = blanket([3, 7, null], { stars: 2, best: 4 });
    expect(revive(JSON.parse(JSON.stringify(saved)))).toEqual({ ...saved, best: 7 });
    expect(revive(null)).toEqual(start());
    expect(revive({ spots: [1, 2] })).toEqual(start());
    const odd = revive({ spots: [99, -1, 1.5, "x", ...new Array(SPOTS - 4).fill(null)], best: "far", stars: -3 });
    expect(odd.spots.every((s) => s === null)).toBe(true);
    expect(odd.best).toBe(0);
    expect(odd.stars).toBe(0);
  });

  it("has a name, a plural and a note for every friend", () => {
    expect(FRIENDS).toHaveLength(TOP + 1);
    for (const f of FRIENDS) expect(f.name && f.many && f.note).toBeTruthy();
  });
});
