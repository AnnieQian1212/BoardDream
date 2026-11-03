import { describe, expect, it } from "vitest";
import { paintingsOf, stepLabel, updatePaintings } from "./paintings";

describe("paintings under way", () => {
  it("keeps each game's own, and forgets a part once it is over", () => {
    updatePaintings("a", { board: stepLabel("painting the board") });
    updatePaintings("b", { cards: { done: 2, total: 9 } });
    expect(paintingsOf("a")).toEqual({ board: "Painting the board…" });
    expect(paintingsOf("b")).toEqual({ cards: { done: 2, total: 9 } });
    updatePaintings("a", { board: undefined, boardError: "not kept" });
    expect(paintingsOf("a")).toEqual({ boardError: "not kept" });
    updatePaintings("a", { boardError: undefined });
    updatePaintings("b", { cards: undefined });
    expect(paintingsOf("a")).toEqual({});
    // Nothing under way reads the same each time, as React's store needs.
    expect(paintingsOf("a")).toBe(paintingsOf("b"));
  });
});
