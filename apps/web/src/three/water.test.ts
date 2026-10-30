import { describe, expect, it } from "vitest";
import { isWaterKind, WaterGrid } from "./water";

const square = (x: number, z: number, size: number): [number, number][] => [
  [x, z],
  [x + size, z],
  [x + size, z + size],
  [x, z + size],
];

describe("isWaterKind", () => {
  it("knows water by the words in a kind", () => {
    for (const kind of ["lagoon", "reef", "sea", "deep-sea", "river_ford", "Harbor", "salt marsh"]) expect(isWaterKind(kind)).toBe(true);
    for (const kind of ["forest", "seaside-market", "wildmere", "reefer", undefined]) expect(isWaterKind(kind)).toBe(false);
  });
});

describe("WaterGrid", () => {
  it("wets only the nodes inside the water", () => {
    const grid = new WaterGrid([square(0, 0, 4)], 0.25);
    expect(grid.isWet(2, 2)).toBe(true);
    expect(grid.isWet(5, 2)).toBe(false);
  });

  it("spreads a ripple, then comes to rest", () => {
    const grid = new WaterGrid([square(0, 0, 4)], 0.25);
    expect(grid.still).toBe(true);
    grid.disturb(2, 2, 1);
    expect(grid.still).toBe(false);
    for (let i = 0; i < 10; i++) grid.step();
    grid.encode();
    // A node a ring away now leans: its slope byte has left the flat 128.
    const node = (x: number, z: number) => Math.round((z - grid.z0) / grid.spacing) * grid.cols + Math.round((x - grid.x0) / grid.spacing);
    const lean = [0, 1].map((ch) => Math.abs(grid.pixels[node(2.75, 2) * 4 + ch] - 128));
    expect(Math.max(...lean)).toBeGreaterThan(0);
    let steps = 10;
    while (grid.step()) steps++;
    expect(grid.still).toBe(true);
    // Within six seconds, after which the table draws no more frames for it.
    expect(steps).toBeLessThan(60 * 6);
  });

  it("keeps waves out of dry ground between two pools", () => {
    const grid = new WaterGrid([square(0, 0, 2), square(3, 0, 2)], 0.2);
    grid.disturb(1, 1, 1);
    for (let i = 0; i < 40; i++) grid.step();
    grid.encode();
    const node = (x: number, z: number) => Math.round((z - grid.z0) / grid.spacing) * grid.cols + Math.round((x - grid.x0) / grid.spacing);
    // The dry strip stays flat, and so does the far pool.
    expect([...grid.pixels.slice(node(2.5, 1) * 4, node(2.5, 1) * 4 + 3)]).toEqual([128, 128, 128]);
    expect([...grid.pixels.slice(node(4, 1) * 4, node(4, 1) * 4 + 3)]).toEqual([128, 128, 128]);
  });

  it("grows its spacing for a sea too large to step every frame", () => {
    const grid = new WaterGrid([square(0, 0, 100)], 0.1);
    expect(grid.cols * grid.rows).toBeLessThanOrEqual(40_000);
  });
});
