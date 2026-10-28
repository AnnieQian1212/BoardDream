import { describe, expect, it } from "vitest";
import { checkRules, checkRulesIsolated } from "./agent/check";
import { playIssues, playtest } from "./agent/playtest";
import { extractCode } from "./agent/prompts";
import { alignmentReport, maskIoU, rasterizePolygon } from "./art/alignment";
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
});

describe("extractCode", () => {
  it("takes the first fenced block", () => {
    expect(extractCode("Here you go:\n```js\nmodule.exports = {};\n```\nDone.")).toBe("module.exports = {};");
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
