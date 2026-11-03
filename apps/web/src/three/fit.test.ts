import { describe, expect, it } from "vitest";
import { firstFitting } from "./fit";

/** What stepping down one size at a time finds. */
function stepping(from: number, fits: (size: number) => boolean) {
  let size = from;
  while (size > 4 && !fits(size)) size *= 0.94;
  return size;
}

describe("firstFitting", () => {
  it("finds the size stepping down would, in far fewer tries", () => {
    for (const from of [3, 4, 5, 12, 40, 90, 200]) {
      for (const room of [0, 2, 3.9, 4, 7, 11.3, 39, 41, 89, 150, 1000]) {
        let tries = 0;
        const fits = (size: number) => {
          tries++;
          return size <= room;
        };
        expect(firstFitting(from, fits), `from ${from}, room ${room}`).toBeCloseTo(stepping(from, (s) => s <= room), 9);
        expect(tries).toBeLessThanOrEqual(8);
      }
    }
  });
});
