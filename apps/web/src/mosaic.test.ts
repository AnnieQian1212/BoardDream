import { describe, expect, test } from "vitest";
import { bonusOf, buy, CELLS, COLS, costOf, emptyCells, fresh, lay, patch, picture, revive } from "./mosaic";

describe("the mosaic", () => {
  test("laying tiles pays one each, more with gilded glass, and never twice for a cell", () => {
    const first = lay(fresh(), [0, 1, 2]);
    expect(first.laid).toBe(3);
    expect(first.mosaic.chips).toBe(3);
    const again = lay({ ...first.mosaic, gild: 2 }, [2, 3]);
    expect(again.laid).toBe(1);
    expect(again.mosaic.chips).toBe(3 + 3);
  });

  test("the last tile finishes the picture: a bonus, the next picture, an empty wall", () => {
    const almost = { ...fresh(), laid: new Array(CELLS).fill(true).map((_, i) => i !== 5) };
    const { mosaic, finished } = lay(almost, [5]);
    expect(finished).toBe(true);
    expect(mosaic.level).toBe(1);
    expect(mosaic.chips).toBe(1 + bonusOf(0));
    expect(mosaic.laid.some(Boolean)).toBe(false);
  });

  test("upgrades cost more each time, need the tesserae, and stop at their maximum", () => {
    const poor = fresh();
    expect(buy(poor, "trowel")).toBe(poor);
    const rich = { ...fresh(), chips: 10_000 };
    const once = buy(rich, "trowel");
    expect(once.trowel).toBe(1);
    expect(costOf(once, "trowel")!).toBeGreaterThan(costOf(rich, "trowel")!);
    let m = rich;
    for (let i = 0; i < 10; i++) m = buy(m, "trowel");
    expect(m.trowel).toBe(4);
    expect(costOf(m, "trowel")).toBeUndefined();
  });

  test("a wider trowel lays a round patch, clipped at the wall's edges", () => {
    expect(patch(COLS + 5, 0)).toEqual([COLS + 5]);
    const wide = patch(COLS + 5, 1);
    expect(wide).toContain(5);
    expect(wide).toContain(2 * COLS + 6);
    expect(patch(0, 2).every((c) => c >= 0 && c < CELLS && c % COLS <= 2)).toBe(true);
  });

  test("apprentices pick cells not laid yet", () => {
    const m = { ...fresh(), laid: new Array(CELLS).fill(true).map((_, i) => i >= 3) };
    expect(emptyCells(m, 10).sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  test("every picture colors every cell", () => {
    for (let level = 0; level < 12; level++) {
      const { colors } = picture(level);
      expect(colors).toHaveLength(CELLS);
      expect(colors.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
    }
  });

  test("a saved mosaic is revived whole, whatever was stored", () => {
    expect(revive(null)).toEqual(fresh());
    expect(revive({ chips: 12.7, level: 2, trowel: 99, laid: [true] })).toMatchObject({ chips: 12, level: 2, trowel: 4, laid: fresh().laid });
  });
});
