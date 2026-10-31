import { describe, expect, it } from "vitest";
import { jellyGeometry, rise, Wobble } from "./jelly";

const HEX: [number, number][] = Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3), Math.sin((i * Math.PI) / 3)]);

describe("jelly pools", () => {
  it("rise from nothing at the shore to a flat top, sloping inward", () => {
    expect(rise(HEX, 1, 0, 0.3)[0]).toBeCloseTo(0, 1);
    expect(rise(HEX, 0, 0, 0.3)).toEqual([1, 0, 0]);
    // Just inside the right-hand edge the dome climbs toward the middle (-x).
    const [f, gx] = rise(HEX, 0.8, 0, 0.3);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
    expect(gx).toBeLessThan(0);
  });

  it("split each pool finely, facing up, with a rise and slope for every vertex", () => {
    const g = jellyGeometry([HEX], 2);
    const count = g.attributes.position.count;
    expect(count).toBeGreaterThan(1000);
    expect(g.attributes.jelly.count).toBe(count);
    expect(g.attributes.jellySlope.count).toBe(count);
    expect(g.attributes.uv.count).toBe(count);
    const p = g.attributes.position;
    for (let i = 0; i < count; i += 3) {
      const [ax, az, bx, bz, cx, cz] = [p.getX(i), p.getZ(i), p.getX(i + 1), p.getZ(i + 1), p.getX(i + 2), p.getZ(i + 2)];
      // The y of (b - a) × (c - a): positive when the triangle faces up.
      expect((bz - az) * (cx - ax) - (bx - ax) * (cz - az)).toBeGreaterThan(0);
    }
  });

  it("handle a concave fan of water wedges around the middle of a tile", () => {
    // Four of six wedges: the middle of the tile is a reflex corner of the pool.
    const fan: [number, number][] = [[0, 0], ...HEX.slice(0, 5)];
    const g = jellyGeometry([fan], 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const [ax, az, bx, bz, cx, cz] = [p.getX(i), p.getZ(i), p.getX(i + 1), p.getZ(i + 1), p.getX(i + 2), p.getZ(i + 2)];
      expect((bz - az) * (cx - ax) - (bx - ax) * (cz - az)).toBeGreaterThan(0);
    }
    const rises = Array.from(g.attributes.jelly.array);
    expect(Math.min(...rises)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...rises)).toBeLessThanOrEqual(1);
  });

  it("bounce back past level after a touch and settle within two seconds", () => {
    const wobble = new Wobble();
    wobble.poke(0.9, 0.5, 0);
    let [low, high, t] = [0, 0, 0];
    for (; !wobble.still && t < 5; t += 1 / 60) {
      wobble.step(1 / 60);
      [low, high] = [Math.min(low, wobble.squash), Math.max(high, wobble.squash)];
    }
    expect(low).toBeLessThan(-0.4);
    expect(high).toBeGreaterThan(0.2);
    expect(t).toBeLessThan(2);
    expect(wobble.squash).toBe(0);
  });
});
