import type { GeometryCell } from "@boarddream/engine";
import { describe, expect, it, test } from "vitest";
import { clipConvex, insetConvex, isWaterCell, isWaterKind, tileOutlines, WaterGrid, waterPolygons } from "./water";

const square = (x: number, z: number, size: number): [number, number][] => [
  [x, z],
  [x + size, z],
  [x + size, z + size],
  [x, z + size],
];

describe("isWaterKind", () => {
  it("knows water by the words in a kind", () => {
    for (const kind of ["lagoon", "reef", "sea", "deep-sea", "river_ford", "Harbor", "salt marsh", "wetland", "headwater", "canal"]) expect(isWaterKind(kind)).toBe(true);
    for (const kind of ["forest", "seaside-market", "wildmere", "reefer", "tide", undefined]) expect(isWaterKind(kind)).toBe(false);
  });

  it("lets a cell's terrain hint overrule its kind's name", () => {
    expect(isWaterCell({ id: "a", polygon: [], kind: "lowhaven", terrain: "water" })).toBe(true);
    expect(isWaterCell({ id: "b", polygon: [], kind: "lake", terrain: "grass" })).toBe(false);
    expect(isWaterCell({ id: "c", polygon: [], kind: "lake" })).toBe(true);
  });
});

describe("waterPolygons", () => {
  // A unit square, corners clockwise from the top left; edge i runs from corner i to corner i + 1.
  const tile = (segments?: string[], kind?: string): GeometryCell => ({
    id: "t",
    polygon: [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ],
    kind,
    segments,
  });

  it("shrinks a whole water cell around its center", () => {
    expect(waterPolygons(tile(undefined, "lake"), 0.5, 0.4)).toEqual([
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ],
    ]);
    expect(waterPolygons(tile(undefined, "meadow"), 0.5, 0.4)).toEqual([]);
  });

  it("joins neighboring water wedges into one fan, even across the first edge", () => {
    // Edges 3 and 0 are water: one fan from the center through corners 3, 0 and 1.
    const fans = waterPolygons(tile(["wetland", "meadow", "meadow", "wetland"]), 0.9, 0.5);
    expect(fans).toEqual([
      [
        [0, 0],
        [-0.5, 0.5],
        [-0.5, -0.5],
        [0.5, -0.5],
      ],
    ]);
    // Water on two opposite edges makes two fans; water all round makes the whole tile.
    expect(waterPolygons(tile(["sea", "meadow", "sea", "meadow"]), 0.9, 0.5)).toHaveLength(2);
    expect(waterPolygons(tile(["sea", "sea", "sea", "sea"]), 0.9, 0.5)).toHaveLength(1);
    expect(waterPolygons(tile(["meadow", "meadow", "heath", "heath"]), 0.9, 0.5)).toEqual([]);
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

describe("an even shore", () => {
  test("a long sea is drawn in by the same distance on every side", () => {
    const sea = { id: "sea", kind: "sea", polygon: [[0, 0], [20, 0], [20, 4], [0, 4]] as [number, number][] };
    // The tile is the cell drawn in evenly (by a tenth of its inradius, 2); the water an even shore inside it.
    const [pool] = waterPolygons(sea, 0.86, 0.75, 0.9);
    const edge = 2 * 0.1 + 2 * (0.9 - 0.86);
    const xs = pool.map(([x]) => x);
    const ys = pool.map(([, y]) => y);
    expect(10 - Math.max(...xs)).toBeCloseTo(edge);
    expect(Math.min(...xs) + 10).toBeCloseTo(edge);
    expect(2 - Math.max(...ys)).toBeCloseTo(edge);
    expect(Math.min(...ys) + 2).toBeCloseTo(edge);
  });

  test("a path is clipped to the part that crosses the water", () => {
    const water: [number, number][] = [[0, 0], [10, 0], [10, 4], [0, 4]];
    const path: [number, number][] = [[-2, 1.8], [5, 1.8], [5, 2.2], [-2, 2.2]];
    const part = clipConvex(path, water);
    expect(Math.min(...part.map(([x]) => x))).toBeCloseTo(0);
    expect(Math.max(...part.map(([x]) => x))).toBeCloseTo(5);
    expect(clipConvex([[20, 20], [21, 20], [21, 21]], water)).toEqual([]);
  });

  test("an outline that is not convex, or too small, is left to the scaled one", () => {
    const ell: [number, number][] = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]];
    expect(insetConvex(ell, 0.1, [1.5, 1.5])).toBeUndefined();
    expect(insetConvex([[0, 0], [1, 0], [1, 1], [0, 1]], 0.6, [0.5, 0.5])).toBeUndefined();
  });
});

describe("tiles that overlap", () => {
  test("a large tile is drawn back from a smaller one across its edge, but not from one inside it", () => {
    const sea = { id: "sea", polygon: [[0, 4], [20, 4], [20, 8], [0, 8]] as [number, number][] };
    const shore = { id: "shore", polygon: [[2, 1], [5, 1], [5, 4.5], [2, 4.5]] as [number, number][] };
    const island = { id: "island", polygon: [[10, 5.5], [12, 5.5], [12, 7], [10, 7]] as [number, number][] };
    const out = tileOutlines([sea, shore, island], 0.9, 1);
    const top = Math.min(...out.get("sea")!.map(([, y]) => y));
    expect(top).toBeGreaterThan(4.5);
    expect(Math.max(...out.get("sea")!.map(([, y]) => y))).toBeCloseTo(7.9);
  });
});
