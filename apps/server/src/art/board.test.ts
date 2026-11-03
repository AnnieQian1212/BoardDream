import { regularPolygon, type Geometry, type GeometryCell } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import { guideColors, legend, rowsOf } from "./board";

const tile = (id: string, kind: string, terrain?: GeometryCell["terrain"], x = 0): GeometryCell => ({
  id,
  kind,
  terrain,
  polygon: [
    [x, 0],
    [x + 1, 0],
    [x + 1, 1],
    [x, 1],
  ],
});

describe("the board painter's guide", () => {
  // Farlight Reefs: three kinds of water, villages on grass, headlands on stone.
  const coast: Geometry = {
    width: 12,
    height: 1,
    cells: [
      tile("a", "headland", "stone", 0),
      tile("b", "village", "grass", 1),
      tile("c", "cove", "water", 2),
      tile("d", "cove", "water", 3),
      tile("e", "wreck", "water", 4),
      tile("f", "reef", "water", 5),
      tile("g", "reef", "water", 6),
      tile("h", "reef", "water", 7),
    ],
    pieces: [],
  };

  it("colors every kind of water a blue, and no two kinds alike", () => {
    const colors = guideColors(coast);
    for (const kind of ["cove", "wreck", "reef"]) {
      const [r, , b] = colors.get(kind)!.rgb;
      expect(b, kind).toBeGreaterThan(r);
      expect(colors.get(kind)!.ground).toBe("water");
    }
    const names = [...colors.values()].map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("tells the painter what ground each kind is", () => {
    const text = legend(coast);
    expect(text).toContain("tiles are cove (water)");
    expect(text).toContain("tiles are village (grassland)");
    expect(text).toContain("tiles are headland (rocky ground)");
    // The commonest water is plain blue.
    expect(text).toContain("blue tiles are reef (water)");
  });

  it("takes a kind named for water as water when its cells give no ground", () => {
    const bay: Geometry = { width: 2, height: 1, cells: [tile("a", "sea", undefined, 0), tile("b", "market", undefined, 1)], pieces: [] };
    expect(guideColors(bay).get("sea")!.ground).toBe("water");
    expect(guideColors(bay).get("market")!.ground).toBeUndefined();
  });

  it("tells the painter how a grid of like tiles is laid out", () => {
    // Farlight Reefs' coast: hexes in rows of 3, 5, 6, 4 and 3.
    const w = Math.sqrt(3);
    const cells = [3, 5, 6, 4, 3].flatMap((count, row) =>
      Array.from({ length: count }, (_, i) => ({ id: `${row}-${i}`, kind: "reef", polygon: regularPolygon(2 + i * w + (row % 2) * (w / 2), 2 + row * 1.5, 1, 6) })),
    );
    expect(rowsOf({ width: 14, height: 10, cells, pieces: [] })).toBe("21 tiles in 5 rows of 3, 5, 6, 4 and 3 from the top");
    // Spaces of mixed sizes are not described.
    const mixed = [tile("a", "field", undefined, 0), tile("b", "field", undefined, 1), tile("c", "field", undefined, 2), { ...tile("d", "order", undefined, 3), polygon: regularPolygon(5, 2, 2, 4) }];
    expect(rowsOf({ width: 8, height: 4, cells: mixed, pieces: [] })).toBeUndefined();
  });
});
