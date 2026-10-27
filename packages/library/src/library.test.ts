import { fuzz, playMatch, type Bot } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import { catalog, lineUp, referenceGames } from "./index";

describe("reference games", () => {
  for (const game of referenceGames) {
    it(`${game.meta.id} survives fuzzing across its parameter space`, () => {
      const report = fuzz(game, { runs: 300 });
      expect(report.failures).toEqual([]);
    });
  }
});

describe("line-up", () => {
  it("detects a vertical four with gravity", () => {
    // Seat 0 always drops in column 0, seat 1 in column 1: seat 0 completes four first.
    const column = (x: number): Bot => ({ moves, game, state }) =>
      moves.find((m) => game.moveTarget?.(state, m)?.startsWith(`${x},`)) ?? moves[0];
    const result = playMatch(lineUp, { numPlayers: 2, bots: [column(0), column(1)], strict: true });
    expect(result.outcome.winners).toEqual([0]);
    expect(result.turns).toBe(7);
  });
});

describe("catalog", () => {
  it("has unique ids", () => {
    expect(new Set(catalog.map((e) => e.id)).size).toBe(catalog.length);
  });
});
