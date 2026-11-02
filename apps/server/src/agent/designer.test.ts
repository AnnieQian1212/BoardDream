import type { Bm25Index } from "@boarddream/retrieval";
import { describe, expect, it } from "vitest";
import type { ChatMessage, ModelClient } from "../meta/client";
import type { RulesChecker } from "./check";
import { reviseGame, type DesignDeps } from "./designer";
import type { DesignEvent, PlayStats, RulesCheck } from "./protocol";

// Take 1-3 stones, last stone wins. Each version the designer writes is "Nim v1", "Nim v2", …
const NIM = `
module.exports = {
  meta: { id: "nim", name: "Nim", family: "grid", mode: "competitive", minPlayers: 2, maxPlayers: 2, summary: "Take stones.", rules: ["Take 1-3 stones."] },
  params: [],
  setup: ({ numPlayers }) => ({ pile: 15, toMove: 0, numPlayers, last: null }),
  activePlayers: (s) => (s.pile === 0 ? [] : [s.toMove]),
  legalMoves: (s) => [1, 2, 3].filter((n) => n <= s.pile),
  applyMove: (s, p, take) => ({ ...s, pile: s.pile - take, toMove: (p + 1) % s.numPlayers, last: p }),
  isTerminal: (s) => s.pile === 0,
  outcome: (s) => ({ winners: s.last === null ? [] : [s.last] }),
};`;
const version = (n: number) => NIM.replace('name: "Nim"', `name: "Nim v${n}"`);
const versionOf = (source: string) => Number(/Nim v(\d+)/.exec(source)?.[1] ?? 0);

const stats = (medianTurns: number): PlayStats => ({ numPlayers: 2, games: 100, medianTurns, drawRate: 0, winRateBySeat: [0.5, 0.5], truncatedRate: 0, moveKinds: ["number"], choiceRate: 0.9 });
const broken = (why: string): Partial<RulesCheck> => ({ ok: false, loadError: why });
const flawed = (issue: string): Partial<RulesCheck> => ({ issues: [issue] });

/**
 * A designer that writes version 1, 2, 3… in turn, and a checker that gives each version its canned
 * verdict (a pass with a playtest by default). The original rules are version 0.
 */
function harness(verdicts: Record<number, Partial<RulesCheck>>, extra: Partial<DesignDeps> = {}) {
  const asked: string[] = [];
  const events: DesignEvent[] = [];
  let written = 0;
  const llm = {
    chatStream: async (messages: ChatMessage[], onText: (piece: string) => void) => {
      asked.push(String(messages.at(-1)?.content));
      const reply = `\`\`\`js\n${version(++written)}\n\`\`\``;
      onText(reply);
      return reply;
    },
  } as unknown as ModelClient;
  const check: RulesChecker = async (source) => ({ ok: true, failures: [], play: stats(10 + versionOf(source)), ...verdicts[versionOf(source)] });
  const deps: DesignDeps = { llm, index: undefined as unknown as Bm25Index, check, maxRepairs: 3, onEvent: (e) => events.push(e), ...extra };
  return { deps, asked, events, written: () => written };
}

describe("the repair loop, seen through a revision", () => {
  it("keeps a change that passes at once, and compares it with the original", async () => {
    const h = harness({});
    const result = await reviseGame(NIM, "a bigger pile", h.deps);
    expect(result.ok).toBe(true);
    expect(versionOf(result.source)).toBe(1);
    expect(result.attempts).toHaveLength(1);
    expect(result.before?.medianTurns).toBe(10);
    expect(result.after?.medianTurns).toBe(11);
    expect(h.events.map((e) => e.type)).toEqual(["writing", "code", "draft", "checked"]);
  });

  it("sends each fault back until the rules pass", async () => {
    const h = harness({ 1: broken("applyMove is not a function"), 2: broken("outcome is not a function") });
    const result = await reviseGame(NIM, "a bigger pile", h.deps);
    expect(result.ok).toBe(true);
    expect(versionOf(result.source)).toBe(3);
    expect(result.attempts.map((a) => a.ok)).toEqual([false, false, true]);
    expect(h.asked[1]).toContain("applyMove is not a function");
    expect(h.asked[2]).toContain("outcome is not a function");
    const checked = h.events.filter((e): e is Extract<DesignEvent, { type: "checked" }> => e.type === "checked");
    expect(checked.map((e) => e.ok)).toEqual([false, false, true]);
    expect(checked[0].problem).toMatch(/did not load: applyMove/);
  });

  it("gives working rules one round for design problems, and only one", async () => {
    const h = harness({ 1: flawed("seat 2 never wins"), 2: flawed("games run long") });
    const result = await reviseGame(NIM, "a bigger pile", h.deps);
    expect(result.ok).toBe(true);
    expect(h.written()).toBe(2);
    expect(versionOf(result.source)).toBe(2);
    expect(h.asked[1]).toContain("seat 2 never wins");
  });

  it("falls back to the last rules that passed when a design fix breaks them for good", async () => {
    const h = harness({ 1: flawed("seat 2 never wins"), 2: broken("a"), 3: broken("b"), 4: broken("c") });
    const result = await reviseGame(NIM, "a bigger pile", h.deps);
    expect(result.attempts).toHaveLength(4);
    expect(result.ok).toBe(true);
    expect(versionOf(result.source)).toBe(1);
    expect(result.after?.medianTurns).toBe(11);
  });

  it("gives up when the repairs run out, leaving the game as it was", async () => {
    const h = harness({ 1: broken("a"), 2: broken("b"), 3: broken("c"), 4: broken("d") });
    const result = await reviseGame(NIM, "a bigger pile", h.deps);
    expect(result.ok).toBe(false);
    expect(result.attempts).toHaveLength(4);
    expect(h.written()).toBe(4);
    expect(result.after).toBeUndefined();
    expect(result.rulesAfter).toEqual([]);
  });

  it("stops between steps once the player has left", async () => {
    const controller = new AbortController();
    const h = harness({ 1: broken("a") });
    const check = h.deps.check!;
    h.deps.check = async (source, opts) => {
      if (versionOf(source) === 1) controller.abort();
      return check(source, opts);
    };
    await expect(reviseGame(NIM, "a bigger pile", { ...h.deps, signal: controller.signal })).rejects.toThrow();
    expect(h.written()).toBe(1);
  });
});
