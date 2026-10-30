import type { GeometryCell } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import { cellSize, clearing, grassSpacing, growthField, growthOf, growthsOf, plant, printUnit, sow } from "./growth";

const hex = (id: string, cx: number, cy: number, extra: Partial<GeometryCell> = {}): GeometryCell => ({
  id,
  polygon: Array.from({ length: 6 }, (_, i) => [cx + Math.cos((Math.PI / 3) * i + Math.PI / 6), cy + Math.sin((Math.PI / 3) * i + Math.PI / 6)] as [number, number]),
  ...extra,
});

describe("growthOf", () => {
  it("knows grassland, forest, grain fields and stony ground by the words in a kind", () => {
    for (const kind of ["meadow", "grassland", "high-pasture", "plains", "Village_Green"]) expect(growthOf(kind)).toBe("meadow");
    for (const kind of ["forest", "woodland", "mistwood", "pine-grove", "deep_woods"]) expect(growthOf(kind)).toBe("forest");
    for (const kind of ["fields", "wheat", "grain-farm", "farmland", "rye"]) expect(growthOf(kind)).toBe("field");
    for (const kind of ["quarry", "stone", "rocky-shore", "ironcrag", "mountains", "iron_mine"]) expect(growthOf(kind)).toBe("rock");
    for (const kind of ["battlefield", "greenhouse", "woodcutter", "lagoon", "acorn", undefined]) expect(growthOf(kind)).toBeUndefined();
  });

  it("lists the growths of a cell or of an edge-matched tile's wedges", () => {
    expect(growthsOf(hex("a", 0, 0, { kind: "quarry" }))).toEqual(["rock"]);
    expect(growthsOf(hex("b", 0, 0, { segments: ["meadow", "fields", "meadow", "lake", "lake", "lake"] }))).toEqual(["meadow", "field"]);
    expect(growthsOf(hex("c", 0, 0, { kind: "lagoon" }))).toEqual([]);
  });
});

describe("sowing a cell", () => {
  const cells = [hex("a", 0, 0, { kind: "forest", label: "wood" }), hex("b", 2, 0, { kind: "quarry" }), { id: "v", polygon: [[0, 0], [0.2, 0], [0.2, 0.2]], kind: "vertex" } as GeometryCell];

  it("sizes grass from green cells, not from small spots", () => {
    expect(cellSize(cells)).toBeCloseTo(Math.sqrt(3), 1);
    expect(printUnit(cells)).toBeGreaterThanOrEqual(1);
  });

  it("grows inside the cell and leaves the name's clearing bare", () => {
    const field = growthField(cells[0], 0.9)!;
    const bare = clearing(cells[0], 1, 0.17);
    const sprouts = sow(cells[0], field, 0.1, bare);
    expect(sprouts.length).toBeGreaterThan(100);
    for (const s of sprouts) {
      expect(Math.hypot(s.x, s.y)).toBeLessThan(0.91);
      expect((s.x / bare[0]) ** 2 + ((s.y - bare[2]) / bare[1]) ** 2).toBeGreaterThanOrEqual(1);
    }
    // The same cell grows the same way every time it is drawn.
    expect(sow(cells[0], field, 0.1, bare)).toEqual(sprouts);
  });

  it("plants trees behind or beside the name, never in front of it", () => {
    const field = growthField(cells[0], 0.9)!;
    const bare = clearing(cells[0], 1, 0.17);
    const trees = plant(sow(cells[0], field, 0.1, bare), field, bare, 0.1, 4);
    expect(trees.length).toBeGreaterThan(0);
    for (const t of trees) expect(Math.abs(t.x) >= bare[0] + 0.2 || t.y <= bare[2] - bare[1] - 0.1).toBe(true);
  });

  it("sows wheat in rows", () => {
    const cell = hex("f", 0, 0, { kind: "fields" });
    const spacing = 0.1;
    const sprouts = sow(cell, growthField(cell, 0.9)!, spacing, clearing(cell, 1, 0.25));
    expect(sprouts.length).toBeGreaterThan(100);
    // Away from the tile's rim, every clump sits in the middle fifth of its row.
    const top = Math.min(...cell.polygon.map(([, y]) => y));
    for (const s of sprouts.filter((s) => Math.hypot(s.x, s.y) < 0.7)) {
      const offset = ((s.y - top) / spacing) % 1;
      expect(offset).toBeGreaterThanOrEqual(0.39);
      expect(offset).toBeLessThanOrEqual(0.61);
    }
  });

  it("sets boulders among stony ground like trees in a forest", () => {
    const cell = hex("q", 0, 0, { kind: "quarry", label: "stone" });
    const field = growthField(cell, 0.9)!;
    const bare = clearing(cell, 1, 0.07);
    const sprouts = sow(cell, field, 0.1, bare);
    expect(plant(sprouts, field, bare, 0.1, 4)).toEqual([]);
    const boulders = plant(sprouts, field, bare, 0.1, 3, "rock");
    expect(boulders.length).toBeGreaterThan(0);
    for (const b of boulders) expect(Math.abs(b.x) >= bare[0] + 0.2 || b.y <= bare[2] - bare[1] - 0.1).toBe(true);
  });

  it("counts stony ground as light cover when spacing clumps", () => {
    const meadows = Array.from({ length: 200 }, (_, i) => hex(`m${i}`, (i % 20) * 2, Math.floor(i / 20) * 2, { kind: "meadow" }));
    const quarries = meadows.map((c) => ({ ...c, kind: "quarry" }));
    expect(grassSpacing(quarries, Math.sqrt(3), 1)).toBeLessThan(grassSpacing(meadows, Math.sqrt(3), 1));
  });

  it("grows on an edge-matched tile's green wedges only", () => {
    const tile = hex("t", 0, 0, { segments: ["meadow", "meadow", "wetland", "wetland", "wetland", "wetland"] });
    const field = growthField(tile, 0.9)!;
    const sprouts = sow(tile, field, 0.08, clearing(tile, 1, 0.17));
    expect(sprouts.length).toBeGreaterThan(0);
    // Wedges 0 and 1 span the corners at 30, 90 and 150 degrees: the half of the tile with y > 0.
    for (const s of sprouts) expect(s.y).toBeGreaterThan(0);
    expect(growthField(hex("w", 0, 0, { segments: Array(6).fill("wetland") }), 0.9)).toBeUndefined();
  });

  it("thins grass on a board with a lot of green", () => {
    const small = [hex("a", 0, 0, { kind: "meadow" })];
    const large = Array.from({ length: 400 }, (_, i) => hex(`m${i}`, (i % 20) * 2, Math.floor(i / 20) * 2, { kind: "meadow" }));
    expect(grassSpacing(large, Math.sqrt(3), 1)).toBeGreaterThan(grassSpacing(small, Math.sqrt(3), 1));
  });
});
