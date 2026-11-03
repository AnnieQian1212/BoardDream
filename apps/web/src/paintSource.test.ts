import type { GeometryCell } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import { darkened, paintedKind, sourceFor, type BoardPaint } from "./paintSource";

const cell = (kind: string, x = 0): GeometryCell => ({
  id: `${kind}-${x}`,
  kind,
  polygon: [
    [x, 0],
    [x + 1, 0],
    [x + 1, 1],
    [x, 1],
  ],
});
// Fogfall Lanterns, painted at night: lanterns and seats.
const paint: BoardPaint = { url: "", width: 10, height: 2, sources: { lantern: [[0.5, 0.5]], villager: [[2.5, 0.5]], "lantern-post": [[4.5, 0.5]] } };

describe("the painting a tile wears", () => {
  it("is its own kind's when it has one", () => {
    expect(paintedKind(paint, cell("lantern"))).toBe("lantern");
    expect(darkened(paint, cell("lantern"))).toBe(false);
  });

  it("is the painted kind a state of it names, dimmed when the state is dark", () => {
    expect(paintedKind(paint, cell("dark-lantern"))).toBe("lantern");
    expect(darkened(paint, cell("dark-lantern"))).toBe(true);
    expect(paintedKind(paint, cell("lit-lantern"))).toBe("lantern");
    expect(darkened(paint, cell("lit-lantern"))).toBe(false);
    expect(sourceFor(paint, cell("dark-lantern", 6), [cell("lantern"), cell("dark-lantern", 6)])).toEqual([0.5, 0.5]);
    // The longest painted kind it names.
    expect(paintedKind(paint, cell("dark-lantern-post"))).toBe("lantern-post");
  });

  it("is none for a kind that names no painted kind", () => {
    expect(paintedKind(paint, cell("exiled-keeper"))).toBeUndefined();
    expect(sourceFor(paint, cell("exiled-keeper"), [])).toBeUndefined();
    // An outpost is not a lantern put out.
    expect(paintedKind(paint, cell("outpost"))).toBeUndefined();
  });
});
