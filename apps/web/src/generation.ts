import type { GameModule } from "@boarddream/engine";
import type { CheckSummary, DesignEvent, Dials, Effort, GameSpec, GenerateReply, MechanicSummary, PlayStats } from "../../server/src/agent/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { mechanicLabel } from "./dials";
import { loadGeneratedGame, rememberOrigin } from "./generated";
import { readEvents } from "./sse";

// The design stream's types come from the server's protocol file (types only), so the two cannot drift.
export type { Dials, Effort } from "../../server/src/agent/protocol";

/** The designer's plan, as the live view shows it. */
export type Plan = GameSpec;
/** A library entry the rules build on. */
export type Mechanic = MechanicSummary;
/** The verdict on one round of rules. */
export type Check = CheckSummary;
export type { PlayStats };

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
  /** The mechanics the player asked the game to be built around, by name. */
  asked?: string[];
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
  /** Which round of rules that draft is. */
  draftAttempt?: number;
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
      let { draft, draftAttempt } = g;
      try {
        draft = loadGeneratedGame(event.source, `draft-${event.attempt}`, g.plan?.rules, g.plan?.title);
        draftAttempt = event.attempt;
      } catch {
        // A draft that does not load keeps the last one; the check will say why.
      }
      return { ...g, attempt: event.attempt, writing: false, draft, draftAttempt, rounds: current(g, { lines: codeLines(g.code).length, writtenAt: now }) };
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

/**
 * What a revision is doing, read from the design stream's typed events (never from the server's
 * log lines): rewriting, playtesting the first version or a fix, fixing a fault, or smoothing a
 * design problem. Undefined for events that change nothing worth saying.
 */
export function revisionStatus(event: DesignEvent): string | undefined {
  switch (event.type) {
    case "writing":
      return event.attempt === 0 ? "Muse Spark is rewriting the rules…" : undefined;
    case "checking":
      return event.attempt === 0 ? "Playtesting the new rules…" : `Playtesting fix ${event.attempt}…`;
    case "checked":
      if (!event.ok) return "Fixing what the change broke…";
      return event.issues?.length ? "Smoothing a design problem…" : undefined;
    default:
      return undefined;
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

/** A change to the rules under way, as its progress bar follows it. */
export interface Revising {
  /** The rules being written or checked: 0 for the rewrite, then one per fix. */
  attempt: number;
  writing: boolean;
  writingSince: number;
  /** How much of the current rules has arrived, in characters, and when its first piece did. */
  written: number;
  codeSince?: number;
  checking?: { done: number; total: number };
}

export const revisingFrom = (now: number): Revising => ({ attempt: 0, writing: true, writingSince: now, written: 0 });

/** A revision moved on by one design event. */
export function reviseStep(r: Revising, event: DesignEvent, now = Date.now()): Revising {
  switch (event.type) {
    case "writing":
      return { attempt: event.attempt, writing: true, writingSince: now, written: 0 };
    case "code":
      return { ...r, written: r.written + event.text.length, codeSince: r.codeSince ?? now };
    case "draft":
      return { ...r, attempt: event.attempt, writing: false, checking: undefined };
    case "checking":
      return { ...r, attempt: event.attempt, writing: false, checking: { done: event.done, total: event.total } };
    default:
      return r;
  }
}

/**
 * About how far a change to the rules is, from 0 to 0.98, given how long the old rules are (the new
 * ones run about as long): the rewrite to 65%, a slow creep while Muse Spark thinks and then the
 * share written, and its playtest to 90%, by the games played. Each fix covers 60% of what is left
 * before 98%, so a long repair slows the bar rather than stopping it. The panel never lets it go back.
 */
export function revisionProgress(r: Revising, now: number, length: number): number {
  const thought = 1 - Math.exp(-(now - r.writingSince) / (THINKING * 1000));
  const written = r.writing ? (r.codeSince ? 0.2 + 0.8 * Math.min(1, r.written / Math.max(1, length)) : 0.2 * thought) : 1;
  const checked = r.writing || !r.checking ? 0 : r.checking.done / Math.max(1, r.checking.total);
  if (r.attempt === 0) return 0.65 * written + 0.25 * checked;
  let start = 0.9;
  for (let i = 1; i < r.attempt; i++) start += 0.6 * (0.98 - start);
  return start + 0.6 * (0.98 - start) * (0.75 * written + 0.25 * checked);
}

/**
 * A design under way sends a heartbeat every 15 s (apps/server/src/index.ts); this long without a
 * word, the server is gone (stopped, or restarted under it) and the page says so.
 */
export const DESIGN_SILENCE_MS = 60_000;

/**
 * Makes a game from an idea, following each step as the server reports it. Cancelling, or leaving
 * the page, closes the stream, and the server stops the work.
 */
export function useGeneration(onReady: (game: GameModule) => void) {
  const [generation, setGeneration] = useState<Generation>();
  const controller = useRef<AbortController>(undefined);
  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(
    async (prompt: string, dials: Dials, invented: boolean, effort?: Effort) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      let g: Generation = {
        surprise: invented,
        started: Date.now(),
        idea: prompt.trim(),
        asked: dials.mustUse?.map(mechanicLabel),
        attempt: 0,
        writing: false,
        code: "",
        checks: [],
        rounds: [],
      };
      const update = (next: Generation) => {
        g = next;
        if (!abort.signal.aborted) setGeneration(next);
      };
      update(g);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim(), dials, invented, effort }),
          signal: abort.signal,
        });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? res.statusText);
        let result: GenerateReply | undefined;
        let failure: string | undefined;
        await readEvents(
          res,
          (event, data) => {
            if (event === "design") update(apply(g, JSON.parse(data) as DesignEvent));
            else if (event === "result") result = JSON.parse(data) as GenerateReply;
            else if (event === "error") failure = data;
          },
          DESIGN_SILENCE_MS,
        );
        if (!result) throw new Error(failure ?? "the server closed the connection");
        if (!result.ok) return update({ ...g, done: { ok: false, title: result.spec.title } });
        const game = loadGeneratedGame(result.source, result.id, result.spec.rules);
        rememberOrigin(game, { createdAt: new Date().toISOString(), idea: g.idea });
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
