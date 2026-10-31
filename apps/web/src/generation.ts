import type { GameModule, PlayMode } from "@boarddream/engine";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadGeneratedGame } from "./generated";
import { readEvents } from "./sse";

/** Mirrors Dials in apps/server/src/agent/spec.ts. */
export interface Dials {
  minPlayers: number;
  maxPlayers: number;
  playMinutes: number;
  complexity: number;
  luck: number;
  mode: PlayMode;
}

/** The designer's plan, as far as the live view shows it (GameSpec in apps/server/src/agent/spec.ts). */
export interface Plan {
  title: string;
  pitch: string;
  family: string;
  mode: PlayMode;
  minPlayers: number;
  maxPlayers: number;
  components: string;
  rules: string[];
  winCondition: string;
  tunables: { key: string; label: string; min: number; max: number; default: number }[];
}

export interface Mechanic {
  id: string;
  title: string;
  description: string;
}

/** The playtest of rules that passed (PlayStats in apps/server/src/agent/playtest.ts). */
export interface PlayStats {
  numPlayers: number;
  games: number;
  medianTurns: number;
  winRateBySeat: number[];
  plannerWinRate?: number;
}

export interface Check {
  attempt: number;
  ok: boolean;
  problem?: string;
  issues?: string[];
  play?: PlayStats;
}

/** Mirrors DesignEvent in apps/server/src/agent/designer.ts. */
type DesignEvent =
  | { type: "spec"; spec: Plan }
  | { type: "mechanics"; mechanics: Mechanic[] }
  | { type: "writing"; attempt: number }
  | { type: "code"; text: string }
  | { type: "draft"; attempt: number; source: string }
  | { type: "checking"; attempt: number; done: number; total: number }
  | ({ type: "checked" } & Check);

/** One round of rules: written (the first draft, or a fix for what the last check found), then checked. */
export interface Round {
  attempt: number;
  /** The verdict this round answers; none for the first draft. */
  answers?: Check;
  writingSince: number;
  codeSince?: number;
  /** Once written: how long the rules are, and when they were done. */
  lines?: number;
  writtenAt?: number;
  checking?: { done: number; total: number };
  check?: Check;
  checkedAt?: number;
}

/** A game being made, as the server reports each step. */
export interface Generation {
  /** The idea is Muse Spark's, as "Surprise me" wrote it. */
  surprise: boolean;
  started: number;
  idea: string;
  plan?: Plan;
  mechanics?: Mechanic[];
  /** When the plan and the mechanics arrived. */
  planAt?: number;
  mechanicsAt?: number;
  /** Every round of rules so far, the current one last. */
  rounds: Round[];
  /** The rules being written or checked: 0 for the first draft, then one per fix. */
  attempt: number;
  writing: boolean;
  /** When the current rules started being written, and when their first piece arrived. */
  writingSince?: number;
  codeSince?: number;
  /** The current attempt's rules as written so far. */
  code: string;
  checking?: { done: number; total: number };
  checks: Check[];
  /** The newest draft that loads in the browser, for bots to play on the table while it is checked. */
  draft?: GameModule;
  done?: { ok: boolean; title: string; game?: GameModule };
  error?: string;
}

export type Step = "plan" | "rules" | "check" | "ready";

/** The code inside a reply's ```js block, as far as it has been written, line by line. */
export const codeLines = (code: string) => (code.includes("```") ? code.replace(/^[\s\S]*?```[a-z]*\n?/, "").replace(/```[\s\S]*$/, "") : code).split("\n");

/**
 * The plan's components as separate items. Plans list them with semicolons, or with commas where
 * each item starts with how many there are ("60 tiles with Hull, Keel and Rigging edges, 4 boards"),
 * so a comma splits only before a count, and never inside parentheses.
 */
export function componentItems(components: string): string[] {
  const parts = components.includes(";")
    ? components.split(";")
    : components.split(/,\s+(?![^()]*\))(?=(?:and\s+)?(?:\d|(?:an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s))/i);
  return parts
    .map((p) => p.trim().replace(/^and\s+/i, "").replace(/\.$/, ""))
    .filter(Boolean)
    .slice(0, 10);
}

/** Changes the current (last) round. */
const current = (g: Generation, change: Partial<Round>): Round[] => [...g.rounds.slice(0, -1), { ...g.rounds.at(-1)!, ...change }];

export function stepOf(g: Generation): Step {
  if (g.done?.ok) return "ready";
  if (!g.plan || !g.mechanics) return "plan";
  return g.writing ? "rules" : "check";
}

function apply(g: Generation, event: DesignEvent): Generation {
  const now = Date.now();
  switch (event.type) {
    case "spec":
      return { ...g, plan: event.spec, planAt: now };
    case "mechanics":
      return { ...g, mechanics: event.mechanics, mechanicsAt: now };
    case "writing":
      return {
        ...g,
        attempt: event.attempt,
        writing: true,
        writingSince: now,
        codeSince: undefined,
        code: "",
        checking: undefined,
        rounds: [...g.rounds, { attempt: event.attempt, answers: event.attempt > 0 ? g.checks.at(-1) : undefined, writingSince: now }],
      };
    case "code":
      return { ...g, code: g.code + event.text, codeSince: g.codeSince ?? now, rounds: g.rounds.at(-1)?.codeSince ? g.rounds : current(g, { codeSince: now }) };
    case "draft": {
      let draft = g.draft;
      try {
        draft = loadGeneratedGame(event.source, `draft-${event.attempt}`, g.plan?.rules, g.plan?.title);
      } catch {
        // A draft that does not load keeps the last one on the table; the check will say why.
      }
      return { ...g, attempt: event.attempt, writing: false, draft, rounds: current(g, { lines: codeLines(g.code).length, writtenAt: now }) };
    }
    case "checking": {
      const checking = { done: event.done, total: event.total };
      return { ...g, checking, rounds: current(g, { checking }) };
    }
    case "checked": {
      const { type: _type, ...check } = event;
      return { ...g, checks: [...g.checks, check], rounds: current(g, { check, checkedAt: now }) };
    }
  }
}

/** Typical lengths, for the progress bar: rules run to about this many characters. */
const RULES_LENGTH = 26_000;
/** Seconds Muse Spark thinks before the rules start to arrive. */
const THINKING = 12;

/**
 * About how far along the game is, from 0 to 1: the plan to 20%, the first draft's writing to 65%
 * and its check to 80%. Rules that pass jump to the end; each fix covers 60% of what is left
 * before 98%, so a long repair slows the bar rather than stopping it. The view never lets it go back.
 */
export function progressOf(g: Generation, now: number): number {
  if (g.done?.ok) return 1;
  const planned = (g.plan ? 0.6 : 0) + (g.mechanics ? 0.4 : 0);
  if (!g.plan || !g.mechanics) return 0.2 * Math.max(planned, 0.8 * (1 - Math.exp(-(now - g.started) / 9000)));
  // Writing: a slow creep while Muse Spark thinks, then the share of a typical length written.
  const thought = g.writingSince ? 1 - Math.exp(-(now - g.writingSince) / (THINKING * 1000)) : 1;
  const written = g.writing ? (g.codeSince ? 0.25 + 0.75 * Math.min(1, g.code.length / RULES_LENGTH) : 0.25 * thought) : 1;
  const checked = g.writing || !g.checking ? 0 : g.checking.done / g.checking.total;
  if (g.attempt === 0) return 0.2 + 0.45 * written + 0.15 * checked;
  let start = 0.8;
  for (let i = 1; i < g.attempt; i++) start += 0.6 * (0.98 - start);
  return start + 0.6 * (0.98 - start) * (0.75 * written + 0.25 * checked);
}

interface GenerateResult {
  id?: string;
  ok: boolean;
  spec: { title: string; rules?: string[] };
  source: string;
}

/**
 * Makes a game from an idea, following each step as the server reports it. Cancelling, or leaving
 * the page, closes the stream, and the server stops the work.
 */
export function useGeneration(onReady: (game: GameModule) => void) {
  const [generation, setGeneration] = useState<Generation>();
  const controller = useRef<AbortController>(undefined);
  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(
    async (prompt: string, dials: Dials, invented: boolean) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      let g: Generation = { surprise: invented, started: Date.now(), idea: prompt.trim(), attempt: 0, writing: false, code: "", checks: [], rounds: [] };
      const update = (next: Generation) => {
        g = next;
        if (!abort.signal.aborted) setGeneration(next);
      };
      update(g);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim(), dials, invented }),
          signal: abort.signal,
        });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? res.statusText);
        let result: GenerateResult | undefined;
        let failure: string | undefined;
        await readEvents(res, (event, data) => {
          if (event === "design") update(apply(g, JSON.parse(data) as DesignEvent));
          else if (event === "result") result = JSON.parse(data) as GenerateResult;
          else if (event === "error") failure = data;
        });
        if (!result) throw new Error(failure ?? "the server closed the connection");
        if (!result.ok) return update({ ...g, done: { ok: false, title: result.spec.title } });
        const game = loadGeneratedGame(result.source, result.id, result.spec.rules);
        update({ ...g, done: { ok: true, title: result.spec.title, game } });
        onReady(game);
      } catch (err) {
        if (!abort.signal.aborted) update({ ...g, error: err instanceof Error ? err.message : String(err) });
      }
    },
    [onReady],
  );

  /** Stops the work; the server hears the stream close. */
  const cancel = useCallback(() => {
    controller.current?.abort();
    setGeneration(undefined);
  }, []);

  return { generation, start, cancel };
}
