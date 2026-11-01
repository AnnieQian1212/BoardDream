import type { GeometryCell } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import { TILE_COLORS } from "../colors";
import { GROUND_COLORS, groundOf, tileColor, zoneColors } from "./ground";

const cell = (id: string, extra: Partial<GeometryCell> = {}): GeometryCell => ({ id, polygon: [[0, 0], [1, 0], [1, 1]], ...extra });

describe("ground", () => {
  it("reads a cell's ground from its terrain hint, else from its kind's name", () => {
    expect(groundOf(cell("a", { kind: "borough-1", terrain: "water" }))).toBe("water");
    expect(groundOf(cell("b", { kind: "pasture" }))).toBe("meadow");
    expect(groundOf(cell("c", { kind: "lake" }))).toBe("water");
    expect(groundOf(cell("d", { kind: "market" }))).toBeUndefined();
    expect(groundOf(cell("e", { kind: "label", terrain: "grass" }))).toBeUndefined();
    expect(groundOf(cell("f", { kind: "meadow", segments: ["meadow", "lake", "lake"] }))).toBeUndefined();
  });

  it("colors a tile by its kind's own color, then by its ground", () => {
    expect(tileColor(cell("a", { kind: "quarry", terrain: "grass" }))).toBe(TILE_COLORS.quarry);
    expect(tileColor(cell("b", { kind: "borough-2", terrain: "forest" }))).toBe(GROUND_COLORS.forest);
    expect(tileColor(cell("c", { kind: "obsidian-flats" }))).toBe(GROUND_COLORS.rock);
    // A kind that names no ground keeps a soft color picked from its name.
    expect(Object.values(GROUND_COLORS)).not.toContain(tileColor(cell("d", { kind: "guild-hall" })));
  });

  it("rims tiles by group only where two groups or more share ground hints", () => {
    const boroughs = [
      cell("a", { kind: "borough-0", terrain: "grass" }),
      cell("b", { kind: "borough-1", terrain: "water" }),
      cell("c", { kind: "borough-0", terrain: "stone" }),
      cell("d", { kind: "meadow", terrain: "grass" }),
      cell("e", { kind: "market" }),
    ];
    const rims = zoneColors(boroughs);
    expect([...rims.keys()].sort()).toEqual(["a", "b", "c"]);
    expect(rims.get("a")).toBe(rims.get("c"));
    expect(rims.get("a")).not.toBe(rims.get("b"));
    // One group alone needs no rim to tell it apart.
    expect(zoneColors([cell("a", { kind: "district", terrain: "grass" }), cell("b", { kind: "district", terrain: "water" })]).size).toBe(0);
  });
});
