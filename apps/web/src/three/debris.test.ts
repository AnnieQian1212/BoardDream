import { describe, expect, it } from "vitest";
import { ChipPool, MAX_CHIPS } from "./debris";
import { seeded } from "./paint";

const run = (pool: ChipPool, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) pool.step(1 / 60);
};

describe("stone chips", () => {
  it("fly up, land on the tiles and come to rest", () => {
    const pool = new ChipPool(1, 2);
    pool.burst(0, 0, seeded(1));
    run(pool, 0.15);
    const flying = Array.from({ length: MAX_CHIPS }, (_, i) => pool.drawnSize(i) > 0 && pool.y[i] > 1);
    expect(flying.filter(Boolean).length).toBeGreaterThan(5);
    run(pool, 1.2);
    for (let i = 0; i < MAX_CHIPS; i++) if (pool.drawnSize(i) > 0) expect(pool.y[i]).toBeCloseTo(1, 5);
    expect(pool.active).toBe(true);
  });

  it("shrink away and leave a quiet board", () => {
    const pool = new ChipPool(1, 2);
    pool.burst(0, 0, seeded(2));
    run(pool, 2.5);
    expect(pool.active).toBe(false);
    expect(pool.step(1 / 60)).toBe(false);
    for (let i = 0; i < MAX_CHIPS; i++) expect(pool.drawnSize(i)).toBe(0);
  });

  it("drop past the edge of the tiles on to the slab", () => {
    // Tiles only where x < 0: chips flying right fall to the slab.
    const pool = new ChipPool(1, 2, (x) => x < 0, 0.4);
    pool.burst(0, 0, seeded(3));
    run(pool, 1.2);
    let low = 0;
    for (let i = 0; i < MAX_CHIPS; i++) {
      if (pool.drawnSize(i) === 0) continue;
      if (pool.x[i] > 0.05) {
        expect(pool.y[i]).toBeCloseTo(0.4, 5);
        low++;
      }
    }
    expect(low).toBeGreaterThan(0);
  });

  it("never keep more than the pool holds", () => {
    const pool = new ChipPool(1, 2);
    const random = seeded(4);
    for (let n = 0; n < 10; n++) pool.burst(n, 0, random);
    expect(pool.age.filter(Number.isFinite).length).toBe(MAX_CHIPS);
  });
});
