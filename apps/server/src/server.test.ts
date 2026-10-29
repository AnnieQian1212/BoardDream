import { describe, expect, it } from "vitest";
import { checkRules, checkRulesIsolated } from "./agent/check";
import { playIssues, playtest, skillEdge } from "./agent/playtest";
import { clientAddress, opponentRequestProblem, RateLimiter } from "./guard";
import { revisedTitle } from "./store";
import { extractCode } from "./agent/prompts";
import { alignmentReport, maskIoU, rasterizePolygon } from "./art/alignment";
import { renderGuide } from "./art/board";
import { encodePng, pngSize } from "./art/png";
import { squareGridGeometry } from "@boarddream/engine";
import { loadGameFromSource } from "./sandbox";

// What a generated module looks like: take 1-3 stones, last stone wins.
const NIM = `
module.exports = {
  meta: { id: "nim", name: "Nim", family: "grid", mode: "competitive", minPlayers: 2, maxPlayers: 2, summary: "" },
  params: [{ key: "pile", label: "Stones", kind: "int", min: 5, max: 30, default: 15 }],
  setup: ({ numPlayers, params }) => ({ pile: params.pile, toMove: 0, numPlayers, last: null }),
  activePlayers: (s) => (s.pile === 0 ? [] : [s.toMove]),
  legalMoves: (s) => [1, 2, 3].filter((n) => n <= s.pile),
  applyMove: (s, p, take) => ({ ...s, pile: s.pile - take, toMove: (p + 1) % s.numPlayers, last: p }),
  isTerminal: (s) => s.pile === 0,
  outcome: (s) => ({ winners: s.last === null ? [] : [s.last] }),
};`;

describe("sandbox", () => {
  it("loads and fuzzes a generated module", () => {
    expect(checkRules(NIM, 200)).toEqual({ ok: true, failures: [] });
  });

  it("can reach the mechanics library", () => {
    const game = loadGameFromSource(
      `const { grid } = require("@boarddream/mechanics");\n${NIM}\nmodule.exports.meta.summary = String(grid.toIndex({ width: 3, height: 3 }, 1, 1));`,
    );
    expect(game.meta.summary).toBe("4");
  });

  it("rejects other modules", () => {
    expect(() => loadGameFromSource(`require("fs");`)).toThrow(/not allowed/);
  });

  it("reports a missing method as a load error", () => {
    const check = checkRules(NIM.replace(/isTerminal:.*\n/, ""), 10);
    expect(check.loadError).toMatch(/missing: isTerminal/);
  });

  it("turns Math.random into a fuzz failure", () => {
    const check = checkRules(NIM.replace("pile: params.pile", "pile: 5 + Math.floor(Math.random() * 9)"), 10);
    expect(check.failures[0].message).toMatch(/Math.random is not allowed/);
  });
});

describe("isolated checker", () => {
  it("fuzzes in a worker thread", async () => {
    const check = await checkRulesIsolated(NIM, { runs: 100 });
    expect(check).toMatchObject({ ok: true, failures: [], issues: [] });
    expect(check.play).toMatchObject({ numPlayers: 2, moveKinds: ["number"] });
    expect(check.play!.choiceRate).toBeGreaterThan(0.5);
  });

  it("kills a hanging game and names the run to replay", async () => {
    const hangs = NIM.replace("applyMove: (s, p, take) => (", "applyMove: (s, p, take) => { if (s.pile < 4) for (;;) {} return (").replace(
      "last: p }),",
      "last: p }); },",
    );
    const started = Date.now();
    const check = await checkRulesIsolated(hangs, { runs: 50, stallMs: 1000 });
    expect(check.ok).toBe(false);
    expect(check.stalled).toMatchObject({ numPlayers: 2 });
    expect(typeof check.stalled!.seed).toBe("number");
    expect(Date.now() - started).toBeLessThan(8000);
  });

  it("reports load errors from the worker", async () => {
    const check = await checkRulesIsolated(`require("fs");`, { runs: 10 });
    expect(check.loadError).toMatch(/not allowed/);
  });
});

describe("playtest", () => {
  it("flags games that work but are not worth playing", () => {
    // Every turn has exactly one legal move and the game ends at once.
    const trivial = loadGameFromSource(NIM.replace("legalMoves: (s) => [1, 2, 3].filter((n) => n <= s.pile)", "legalMoves: (s) => [s.pile]"));
    const stats = playtest(trivial);
    expect(stats.choiceRate).toBe(0);
    expect(playIssues(stats, "competitive").join(" ")).toMatch(/over too fast.*real choice/);
    expect(playIssues(playtest(loadGameFromSource(NIM)), "competitive")).toEqual([]);
  });

  it("flags games where choices do not change who wins", () => {
    // Players pick a number for twelve turns, then a coin flip decides the game.
    const coin = loadGameFromSource(`
module.exports = {
  meta: { id: "coin", name: "Coin", family: "grid", mode: "competitive", minPlayers: 2, maxPlayers: 2, summary: "" },
  params: [],
  setup: () => ({ turn: 0, winner: null }),
  activePlayers: (s) => (s.winner === null ? [s.turn % 2] : []),
  legalMoves: () => [1, 2, 3],
  applyMove: (s, p, n, rng) => ({ turn: s.turn + 1, winner: s.turn === 11 ? rng.int(2) : null }),
  isTerminal: (s) => s.winner !== null,
  outcome: (s) => ({ winners: s.winner === null ? [] : [s.winner] }),
};`);
    const stats = playtest(coin, { games: 50 });
    expect(skillEdge(stats)!).toBeLessThan(0.25);
    expect(playIssues(stats, "competitive").join(" ")).toMatch(/decisions barely matter/);
    // Nim rewards planning; bluffing games are not measured.
    expect(skillEdge(playtest(loadGameFromSource(NIM)))!).toBeGreaterThan(0.25);
    expect(playtest(loadGameFromSource(NIM.replace('family: "grid"', 'family: "bluff"'))).plannerWinRate).toBeUndefined();
  });

  it("flags mid-game scores that point the wrong way", () => {
    // The lowest total after 40 turns wins, but the scores reported mid-game make a bigger total look better.
    const backwards = loadGameFromSource(`
module.exports = {
  meta: { id: "low", name: "Low", family: "grid", mode: "competitive", minPlayers: 2, maxPlayers: 2, summary: "" },
  params: [],
  setup: () => ({ turn: 0, totals: [0, 0] }),
  activePlayers: (s) => (s.turn < 40 ? [s.turn % 2] : []),
  legalMoves: () => [1, 2, 3],
  applyMove: (s, p, n) => ({ turn: s.turn + 1, totals: s.totals.map((t, i) => (i === p ? t + n : t)) }),
  isTerminal: (s) => s.turn >= 40,
  outcome: (s) => ({
    winners: s.turn < 40 || s.totals[0] === s.totals[1] ? [] : [s.totals[0] < s.totals[1] ? 0 : 1],
    scores: s.totals,
  }),
};`);
    const stats = playtest(backwards, { games: 20 });
    expect(stats.plannerWinRate!).toBeLessThan(0.375);
    expect(playIssues(stats, "competitive").join(" ")).toMatch(/mid-game scores mislead/);
  });
});

describe("extractCode", () => {
  it("takes the first fenced block", () => {
    expect(extractCode("Here you go:\n```js\nmodule.exports = {};\n```\nDone.")).toBe("module.exports = {};");
  });
});

describe("board art", () => {
  it("writes PNGs whose header reports their size", () => {
    const png = encodePng(3, 2, new Uint8Array(3 * 2 * 4).fill(200));
    expect(pngSize(png)).toEqual({ width: 3, height: 2 });
    expect(pngSize(new Uint8Array([1, 2, 3]))).toBeUndefined();
  });

  it("renders a guide image at the board's aspect ratio", () => {
    const { png, size } = renderGuide(squareGridGeometry(4, 2));
    expect(pngSize(png)).toEqual({ width: 1536, height: 768 });
    expect(size.scale).toBe(384);
  });
});

describe("alignment", () => {
  it("scores shifted squares by IoU", () => {
    const a = rasterizePolygon([[0, 0], [4, 0], [4, 4], [0, 4]], 8, 8);
    const b = rasterizePolygon([[2, 0], [6, 0], [6, 4], [2, 4]], 8, 8);
    expect(a.data.reduce((n, v) => n + v, 0)).toBe(16);
    expect(maskIoU(a, b)).toBeCloseTo(1 / 3);
    const report = alignmentReport(new Map([["c", a]]), new Map([["c", b]]));
    expect(report.misaligned.map((m) => m.id)).toEqual(["c"]);
  });
});

describe("guard", () => {
  it("limits each client per window and everyone per day", () => {
    const limiter = new RateLimiter({ perClient: 2, windowMs: 1000, perDay: 3 });
    const t = Date.parse("2026-10-28T12:00:00Z");
    expect(limiter.take("a", t).ok).toBe(true);
    expect(limiter.take("a", t + 1).ok).toBe(true);
    expect(limiter.take("a", t + 2)).toMatchObject({ ok: false, retryAfterS: 1 });
    // Once the window has passed the client may call again; that is the day's third call.
    expect(limiter.take("a", t + 1001).ok).toBe(true);
    expect(limiter.take("b", t + 1002)).toMatchObject({ ok: false, reason: expect.stringMatching(/daily/) });
    expect(limiter.take("b", Date.parse("2026-10-29T00:00:01Z")).ok).toBe(true);
  });

  it("turns away opponent requests that are malformed or too large for the prompt", () => {
    const fine = { game: "Fenlight", rules: ["Two wisps hide."], seat: 1, numPlayers: 6, table: "P1: Votes 0", recent: [], moves: ["accuse P2", "stay quiet"], advice: 1 };
    expect(opponentRequestProblem(fine)).toBe(null);
    expect(opponentRequestProblem({ ...fine, seat: 6 })).toMatch(/seat/);
    expect(opponentRequestProblem({ ...fine, table: "x".repeat(9000) })).toMatch(/table/);
    expect(opponentRequestProblem({ ...fine, moves: [] })).toMatch(/moves/);
    expect(opponentRequestProblem({ ...fine, advice: 2 })).toMatch(/advice/);
    expect(opponentRequestProblem("hello")).toMatch(/object/);
    expect(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientAddress(new Headers(), "127.0.0.1")).toBe("127.0.0.1");
  });
});

describe("revisions", () => {
  it("number revised versions of a game", () => {
    expect(revisedTitle("Abbey of Ink and Vine")).toBe("Abbey of Ink and Vine (revised)");
    expect(revisedTitle("Abbey of Ink and Vine (revised)")).toBe("Abbey of Ink and Vine (revised 2)");
    expect(revisedTitle("Abbey of Ink and Vine (revised 2)")).toBe("Abbey of Ink and Vine (revised 3)");
  });
});
