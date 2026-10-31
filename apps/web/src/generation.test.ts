import { describe, expect, it } from "vitest";
import { progressOf, stepOf, type Generation } from "./generation";

const t0 = 1_000_000;
const base: Generation = { surprise: false, started: t0, idea: "rival lighthouse keepers", attempt: 0, writing: false, code: "", checks: [] };
const plan = { title: "Beacon", pitch: "", family: "map", mode: "competitive" as const, minPlayers: 2, maxPlayers: 4, components: "", rules: [], winCondition: "", tunables: [] };
const planned: Generation = { ...base, plan, mechanics: [{ id: "mech:market", title: "Card market", description: "" }] };

describe("generation progress", () => {
  it("moves through the steps as the plan, the rules and the playtest arrive", () => {
    expect(stepOf({ ...base, surprise: true, idea: undefined })).toBe("idea");
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
