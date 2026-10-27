import { createRng, fuzz, playMatch, randomBot, simulate, type Bot } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import { catalog, defaultBot, hexGame, iDoubtIt, liarsDice, liarsDiceBot, lineUp, raceHome, referenceGames, reversi } from "./index";
import { raisesAbove } from "./mechanics/bidding";
import { deal, draw, numberedDeck, removeCards } from "./mechanics/deck";
import { atLeastProbability, countFace } from "./mechanics/dice";
import { dealRoles, visibleRoles } from "./mechanics/roles";
import { scoreWinners } from "./mechanics/scoring";
import { applyJumps, bounceMove, generateJumps } from "./mechanics/shortcuts";
import { nextSeat } from "./mechanics/turns";
import { majority, topVoted } from "./mechanics/voting";

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

describe("reversi", () => {
  const opening = reversi.setup({ numPlayers: 2, params: { size: 8 }, rng: createRng(1) });

  it("offers the four standard opening moves", () => {
    // (3,2), (2,3), (5,4), (4,5) on an 8x8 board.
    expect(reversi.legalMoves(opening, 0)).toEqual([19, 26, 37, 44]);
  });

  it("flips the trapped disc", () => {
    const next = reversi.applyMove(opening, 0, 19, createRng(1));
    expect(next.cells[19]).toBe(0);
    expect(next.cells[27]).toBe(0);
    expect(next.toMove).toBe(1);
  });
});

describe("hex", () => {
  it("wins on a top-to-bottom chain", () => {
    // Seat 0 holds column q = 0 except the bottom cell; claiming it completes the chain.
    const size = 4;
    const cells = new Array(size * size).fill(null);
    for (let r = 0; r < size - 1; r++) cells[r * size] = 0;
    const state = { size, swapRule: false, cells, toMove: 0, moves: 6, winner: null };
    expect(hexGame.applyMove(state, 0, (size - 1) * size, createRng(1)).winner).toBe(0);
  });

  it("mirrors the opening stone on a swap", () => {
    const cells = new Array(16).fill(null);
    cells[1] = 0; // (q 1, r 0)
    const state = { size: 4, swapRule: true, cells, toMove: 1, moves: 1, winner: null };
    expect(hexGame.legalMoves(state, 1)).toContain(-1);
    const next = hexGame.applyMove(state, 1, -1, createRng(1));
    expect(next.cells.flatMap((c, i) => (c === null ? [] : [[i, c]]))).toEqual([[4, 1]]); // (q 0, r 1)
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

describe("i-doubt-it", () => {
  const base = {
    numPlayers: 2,
    ranks: 13,
    maxPlays: 180,
    claim: 3,
    phase: "respond" as const,
    toMove: 1,
    plays: 5,
    lastReveal: null,
    winners: null,
  };

  it("gives the pile to a caught liar", () => {
    // Seat 0 played a 5 claiming it was a 3.
    const state = { ...base, hands: [[4, 4], [2, 9]], pile: [7, 7, 5], lastPlay: { player: 0, rank: 5, count: 1, claim: 3 } };
    const next = iDoubtIt.applyMove(state, 1, { type: "doubt" }, createRng(1));
    expect(next.hands[0]).toEqual([4, 4, 5, 7, 7]);
    expect(next.pile).toEqual([]);
    expect(next).toMatchObject({ phase: "play", toMove: 1, claim: 4, winners: null });
  });

  it("lets an honest last play win", () => {
    const state = { ...base, hands: [[], [2, 9]], pile: [3], lastPlay: { player: 0, rank: 3, count: 1, claim: 3 } };
    expect(iDoubtIt.applyMove(state, 1, { type: "doubt" }, createRng(1)).winners).toEqual([0]);
  });

  it("keeps a rival's real cards out of their view and the log", () => {
    const state = { ...base, hands: [[4], [2, 9]], pile: [5], lastPlay: { player: 0, rank: 5, count: 1, claim: 3 } };
    expect(iDoubtIt.view!(state, 1)).toMatchObject({ lastPlay: { player: 0, count: 1, claim: 3 } });
    expect(iDoubtIt.view!(state, 1)).not.toMatchObject({ lastPlay: { rank: 5 } });
    const playing = { ...state, phase: "play" as const, toMove: 0, lastPlay: null };
    expect(iDoubtIt.describeMove!(playing, { type: "play", rank: 5, count: 1 }, 1)).toBe("play 1 card as 3");
    expect(iDoubtIt.describeMove!(playing, { type: "play", rank: 5, count: 1 }, 0)).toBe("play 1 × 5 as 3");
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

  it("deals, draws and reshuffles", () => {
    expect(deal([1, 2, 3, 4, 5], 2)).toEqual({ hands: [[1, 3, 5], [2, 4]], rest: [] });
    expect(deal([1, 2, 3, 4, 5], 2, 1)).toEqual({ hands: [[1], [2]], rest: [3, 4, 5] });
    const result = draw(createRng(1), { drawPile: [1], discard: [7, 8] }, 3);
    expect(result.drawn[0]).toBe(1);
    expect(result.drawn.slice(1).sort()).toEqual([7, 8]);
    expect(result.discard).toEqual([]);
    expect(removeCards([3, 5, 3, 3], 3, 2)).toEqual([5, 3]);
    expect(numberedDeck(3, 2)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("skips seats that are out", () => {
    const out = new Set([1, 2]);
    expect(nextSeat(0, 4, (s) => !out.has(s))).toBe(3);
    expect(nextSeat(0, 4, () => true, -1)).toBe(3);
    expect(nextSeat(2, 3, (s) => s === 2)).toBe(2);
  });

  it("scores ties as shared wins and full ties as draws", () => {
    expect(scoreWinners([5, 3, 5])).toEqual([0, 2]);
    expect(scoreWinners([4, 4])).toEqual([]);
  });

  it("bounces and follows jumps", () => {
    expect(bounceMove(8, 4, 9)).toBe(6);
    expect(applyJumps(4, [[4, 12], [20, 3]])).toBe(12);
    expect(applyJumps(5, [[4, 12]])).toBe(5);
  });

  it("generates jumps that never chain", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const jumps = generateJumps(createRng(seed), 30, 8, 8);
      const squares = jumps.flat();
      expect(new Set(squares).size).toBe(squares.length);
      expect(squares.every((s) => s > 0 && s < 29)).toBe(true);
    }
  });

  it("deals roles and shows teammates", () => {
    const roles = dealRoles(createRng(3), 5, { wolf: 2 }, "villager");
    expect(roles.filter((r) => r === "wolf").length).toBe(2);
    const wolf = roles.indexOf("wolf");
    const villager = roles.indexOf("villager");
    const knows = (role: string) => role === "wolf";
    expect(visibleRoles(roles, wolf, knows).filter((r) => r === "wolf").length).toBe(2);
    expect(visibleRoles(roles, villager, knows).filter((r) => r !== null)).toEqual(["villager"]);
  });

  it("tallies votes", () => {
    expect(topVoted([1, 2, 1, null], 3)).toEqual([1]);
    expect(topVoted([0, 1], 3)).toEqual([0, 1]);
    expect(majority([1, 1, 2], 3)).toBe(1);
    expect(majority([1, 2, null], 3)).toBeNull();
  });
});

describe("catalog", () => {
  it("has unique ids", () => {
    expect(new Set(catalog.map((e) => e.id)).size).toBe(catalog.length);
  });

  it("points ready entries at real sources", () => {
    // Vite's import.meta.glob lists the source files without loading them.
    const sources = (import.meta as unknown as { glob(pattern: string): Record<string, unknown> }).glob("./**/*.ts");
    for (const entry of catalog.filter((e) => e.status === "ready")) {
      expect(entry.source && `./${entry.source}` in sources, entry.id).toBe(true);
    }
  });
});
