import { createRng, fuzz, playMatch, randomBot, simulate, type Bot } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import { catalog, defaultBot, liarsDice, liarsDiceBot, lineUp, raceHome, referenceGames } from "./index";
import { raisesAbove } from "./mechanics/bidding";
import { atLeastProbability, countFace } from "./mechanics/dice";

describe("reference games", () => {
  for (const game of referenceGames) {
    it(`${game.meta.id} survives fuzzing across its parameter space`, () => {
      const report = fuzz(game, { runs: 300, determinismChecks: 30 });
      expect(report.failures).toEqual([]);
    });

    it(`${game.meta.id} also passes with its default bot`, () => {
      const bot = defaultBot(game);
      const result = playMatch(game, { numPlayers: game.meta.maxPlayers, bots: new Array(game.meta.maxPlayers).fill(bot), strict: true });
      expect(result.truncated).toBe(false);
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

describe("race-home", () => {
  const base = {
    trackLength: 16,
    sixToEnter: true,
    maxRounds: 80,
    numPlayers: 2,
    starts: [0, 8],
    toMove: 0,
    round: 0,
    winners: null,
  };

  it("sends a rival back to base when landing on it", () => {
    // Seat 0 moves from square 3 to 5; seat 1's pawn is 13 steps past square 8, which is square 5.
    const state = { ...base, pawns: [[3], [13]], roll: 2 };
    const next = raceHome.applyMove(state, 0, { type: "advance", pawn: 0 }, createRng(1));
    expect(next.pawns).toEqual([[5], [-1]]);
    expect(next.toMove).toBe(1);
  });

  it("protects pawns on start squares", () => {
    // Seat 1's pawn sits on square 0, seat 0's start square.
    const state = { ...base, pawns: [[-1], [8]], roll: 6 };
    const next = raceHome.applyMove(state, 0, { type: "advance", pawn: 0 }, createRng(1));
    expect(next.pawns).toEqual([[0], [8]]);
    expect(next.toMove).toBe(0); // a six rolls again
  });

  it("forces a pass when no pawn can enter", () => {
    const state = { ...base, pawns: [[-1, -1], [-1, -1]], roll: 3 };
    expect(raceHome.legalMoves(state, 0)).toEqual([{ type: "pass" }]);
  });
});

describe("liars-dice", () => {
  const state = {
    numPlayers: 2,
    wildOnes: true,
    dice: [
      [1, 5],
      [5, 3],
    ],
    bid: { quantity: 3, face: 5 },
    bidder: 0,
    toMove: 1,
    lastReveal: null,
    winner: null,
  };

  it("counts wild ones and penalizes a wrong challenge", () => {
    // Fives on the table: 1 (wild) + 5 + 5 = 3, so the bid of three 5s holds and the challenger loses.
    const next = liarsDice.applyMove(state, 1, { type: "liar" }, createRng(1));
    expect(next.lastReveal).toMatchObject({ count: 3, loser: 1 });
    expect(next.dice.map((row) => row.length)).toEqual([2, 1]);
    expect(next.toMove).toBe(1);
  });

  it("hides other players' dice", () => {
    const view = liarsDice.view!(state, 1) as Record<string, unknown>;
    expect(view).not.toHaveProperty("dice");
    expect(view.myDice).toEqual([5, 3]);
    const labels = liarsDice.geometry!(state, 1).pieces.filter((p) => p.owner === 0).map((p) => p.label);
    expect(labels).toEqual(["?", "?"]);
  });

  it("probability bot beats random play", () => {
    const bot = liarsDiceBot();
    const asFirst = simulate(liarsDice, { numPlayers: 2, games: 150, bots: [bot, randomBot] });
    const asSecond = simulate(liarsDice, { numPlayers: 2, games: 150, seed: 1000, bots: [randomBot, bot] });
    const winRate = (asFirst.winRateBySeat[0] + asSecond.winRateBySeat[1]) / 2;
    expect(winRate).toBeGreaterThan(0.75);
  });
});

describe("mechanics", () => {
  it("computes binomial tails", () => {
    expect(atLeastProbability(2, 0.5, 1)).toBeCloseTo(0.75);
    expect(atLeastProbability(3, 1 / 6, 0)).toBe(1);
    expect(atLeastProbability(3, 1 / 6, 4)).toBe(0);
  });

  it("counts wild faces", () => {
    expect(countFace([1, 1, 4, 6], 4, 1)).toBe(3);
    expect(countFace([1, 1, 4, 6], 1, 1)).toBe(2);
  });

  it("lists raises in order", () => {
    expect(raisesAbove({ quantity: 2, face: 5 }, { maxQuantity: 3, faces: [2, 3, 4, 5, 6] })).toEqual([
      { quantity: 2, face: 6 },
      { quantity: 3, face: 2 },
      { quantity: 3, face: 3 },
      { quantity: 3, face: 4 },
      { quantity: 3, face: 5 },
      { quantity: 3, face: 6 },
    ]);
  });
});

describe("catalog", () => {
  it("has unique ids", () => {
    expect(new Set(catalog.map((e) => e.id)).size).toBe(catalog.length);
  });
});
