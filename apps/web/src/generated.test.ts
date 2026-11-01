import { rectPolygon, type GameModule } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import { trimBoard } from "./generated";

/**
 * A race on a 20 × 12 board whose track only runs from x = 5 to 15: a pawn steps one cell a turn,
 * and the finish cell appears once it is there.
 */
function race(width = 20, height = 12, x0 = 5, y0 = 5): GameModule<{ at: number }, "step"> {
  return {
    meta: { id: "race", name: "Race", family: "grid", mode: "competitive", minPlayers: 2, maxPlayers: 2, summary: "" },
    params: [],
    setup: () => ({ at: 0 }),
    activePlayers: (s) => (s.at >= 9 ? [] : [0]),
    legalMoves: () => ["step"],
    applyMove: (s) => ({ at: s.at + 1 }),
    isTerminal: (s) => s.at >= 9,
    outcome: () => ({ winners: [0] }),
    geometry: (s) => ({
      width,
      height,
      cells: Array.from({ length: s.at >= 9 ? 11 : 10 }, (_, i) => ({ id: `c${i}`, polygon: rectPolygon(x0 + i, y0, 1, 2) })),
      pieces: [{ id: "pawn", x: x0 + 0.5 + s.at, y: y0 + 1, r: 0.3 }],
    }),
  };
}

describe("trimBoard", () => {
  it("trims a board to what its cells and pieces ever reach, the same for every state", () => {
    const game = trimBoard(race() as GameModule);
    const start = game.geometry!({ at: 0 });
    const end = game.geometry!({ at: 9 });
    // The finish cell (x = 15 to 16) only appears at the end, and the first board already leaves room for it.
    expect(start.width).toBeCloseTo(11 + 2 * 0.33, 5);
    expect(start.height).toBeCloseTo(2 + 2 * 0.33, 5);
    expect(end.width).toBe(start.width);
    const [x, y] = start.cells[0].polygon[0];
    expect(x).toBeCloseTo(0.33, 5);
    expect(y).toBeCloseTo(0.33, 5);
    expect(end.pieces[0].x).toBeCloseTo(5.5 + 9 - 5 + 0.33, 5);
  });

  it("leaves a board that its content already fills as it is", () => {
    const game = trimBoard(race(11.5, 2.5, 0.2, 0.2) as GameModule);
    const board = game.geometry!({ at: 3 });
    expect(board.width).toBe(11.5);
    expect(board.cells[0].polygon[0]).toEqual([0.2, 0.2]);
  });
});
