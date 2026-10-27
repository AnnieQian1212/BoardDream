import { describe, expect, it } from "vitest";
import { checkRules } from "./agent/designer";
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
