import { describe, expect, it } from "vitest";
import { componentItems, progressOf, reviseStep, revisingFrom, revisionProgress, revisionStatus, stepOf, type Generation, type Plan } from "./generation";

const t0 = 1_000_000;
const base: Generation = { surprise: false, started: t0, idea: "rival lighthouse keepers", attempt: 0, writing: false, code: "", checks: [], rounds: [] };
const plan: Plan = { title: "Beacon", pitch: "", family: "map", mode: "competitive", minPlayers: 2, maxPlayers: 4, components: "", rules: [], winCondition: "", mechanics: [], tunables: [] };
const planned: Generation = { ...base, plan, mechanics: [{ id: "mech:market", title: "Card market", description: "" }] };

describe("generation progress", () => {
  it("moves through the steps as the plan, the rules and the playtest arrive", () => {
    expect(stepOf(base)).toBe("plan");
    expect(progressOf(base, t0 + 5000)).toBeLessThan(0.2);
    const thinking: Generation = { ...planned, writing: true, writingSince: t0 + 8000 };
    expect(stepOf(thinking)).toBe("rules");
    const early = progressOf(thinking, t0 + 9000);
    const later = progressOf(thinking, t0 + 20_000);
    expect(early).toBeGreaterThanOrEqual(0.2);
    expect(later).toBeGreaterThan(early);
    const half = progressOf({ ...thinking, codeSince: t0 + 20_000, code: "x".repeat(13_000) }, t0 + 25_000);
    expect(half).toBeGreaterThan(later);
    const checking: Generation = { ...planned, checking: { done: 565, total: 1130 } };
    expect(stepOf(checking)).toBe("check");
    expect(progressOf(checking, t0)).toBeCloseTo(0.725, 3);
    expect(progressOf({ ...checking, done: { ok: true, title: "Beacon" } }, t0)).toBe(1);
  });

  it("keeps a fix ahead of the first draft and short of the end", () => {
    const fixing: Generation = { ...planned, attempt: 1, writing: true, writingSince: t0, codeSince: t0, code: "x".repeat(26_000) };
    const fix = progressOf(fixing, t0 + 30_000);
    expect(fix).toBeGreaterThan(0.8);
    expect(fix).toBeLessThan(0.98);
    const second = progressOf({ ...fixing, attempt: 2, code: "" , codeSince: undefined, writingSince: t0 + 30_000 }, t0 + 30_000);
    expect(second).toBeGreaterThan(0.8);
    expect(second).toBeLessThan(0.98);
  });
});

describe("components in the box", () => {
  it("split at semicolons, or at commas before a count, never inside parentheses", () => {
    expect(
      componentItems(
        "5x5 harbor basin board divided into 6 districts, 60 drydock tiles with Hull, Keel and Rigging edges, 32 Ship Contract cards in 3 classes Frigate, Clipper and Ironclad, 40 prestige seals, and 4 player drydock boards.",
      ),
    ).toEqual([
      "5x5 harbor basin board divided into 6 districts",
      "60 drydock tiles with Hull, Keel and Rigging edges",
      "32 Ship Contract cards in 3 classes Frigate, Clipper and Ironclad",
      "40 prestige seals",
      "4 player drydock boards",
    ]);
    expect(componentItems("a 19-hex board, 60 tiles (6 edges, 3 kinds), one deck")).toEqual(["a 19-hex board", "60 tiles (6 edges, 3 kinds)", "one deck"]);
    expect(componentItems("19-hex atoll board; 60 reef tiles, each with 6 edges; 4 diver sets")).toEqual(["19-hex atoll board", "60 reef tiles, each with 6 edges", "4 diver sets"]);
  });
});

describe("a revision's status", () => {
  it("follows the typed design events: rewrite, playtest, fix, smooth", () => {
    expect(revisionStatus({ type: "writing", attempt: 0 })).toBe("Muse Spark is rewriting the rules…");
    expect(revisionStatus({ type: "checking", attempt: 0, done: 10, total: 1000 })).toBe("Playtesting the new rules…");
    expect(revisionStatus({ type: "checked", attempt: 0, ok: false, problem: "a game never ended" })).toBe("Fixing what the change broke…");
    expect(revisionStatus({ type: "checking", attempt: 2, done: 0, total: 1000 })).toBe("Playtesting fix 2…");
    expect(revisionStatus({ type: "checked", attempt: 2, ok: true, issues: ["seat 1 wins 70%"] })).toBe("Smoothing a design problem…");
  });

  it("has a progress bar that follows the rewrite, the playtest and any fix, and never reaches the end early", () => {
    const t0 = 1_000_000;
    const length = 20_000;
    let r = revisingFrom(t0);
    const thinking = revisionProgress(r, t0 + 6000, length);
    expect(thinking).toBeGreaterThan(0);
    expect(thinking).toBeLessThan(0.13);
    r = reviseStep(r, { type: "code", text: "x".repeat(10_000) }, t0 + 15_000);
    expect(revisionProgress(r, t0 + 16_000, length)).toBeCloseTo(0.65 * 0.6, 5);
    r = reviseStep(r, { type: "draft", attempt: 0, source: "" }, t0 + 40_000);
    expect(revisionProgress(r, t0 + 40_000, length)).toBeCloseTo(0.65, 5);
    r = reviseStep(r, { type: "checking", attempt: 0, done: 500, total: 1000 }, t0 + 45_000);
    expect(revisionProgress(r, t0 + 45_000, length)).toBeCloseTo(0.775, 5);
    r = reviseStep(r, { type: "checked", attempt: 0, ok: false, problem: "a game never ended" }, t0 + 50_000);
    r = reviseStep(r, { type: "writing", attempt: 1 }, t0 + 50_000);
    const fixing = revisionProgress(r, t0 + 50_000, length);
    expect(fixing).toBeGreaterThanOrEqual(0.9);
    r = reviseStep(r, { type: "checking", attempt: 1, done: 1000, total: 1000 }, t0 + 80_000);
    expect(revisionProgress(r, t0 + 80_000, length)).toBeCloseTo(0.9 + 0.6 * 0.08, 5);
    expect(revisionProgress(r, t0 + 80_000, length)).toBeLessThan(0.98);
  });

  it("says nothing new for events that change nothing worth saying", () => {
    expect(revisionStatus({ type: "writing", attempt: 1 })).toBeUndefined();
    expect(revisionStatus({ type: "code", text: "export default" })).toBeUndefined();
    expect(revisionStatus({ type: "draft", attempt: 0, source: "" })).toBeUndefined();
    expect(revisionStatus({ type: "checked", attempt: 0, ok: true })).toBeUndefined();
  });
});
