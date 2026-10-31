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

/** A game being made, as the server reports each step. */
export interface Generation {
  /** Muse Spark invents the idea ("Surprise me"). */
  surprise: boolean;
  started: number;
  idea?: string;
  plan?: Plan;
  mechanics?: Mechanic[];
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

export type Step = "idea" | "plan" | "rules" | "check" | "ready";

export function stepOf(g: Generation): Step {
  if (g.done?.ok) return "ready";
  if (!g.idea) return "idea";
  if (!g.plan || !g.mechanics) return "plan";
  return g.writing ? "rules" : "check";
}

function apply(g: Generation, event: DesignEvent): Generation {
  const now = Date.now();
  switch (event.type) {
    case "spec":
      return { ...g, plan: event.spec };
    case "mechanics":
      return { ...g, mechanics: event.mechanics };
    case "writing":
      return { ...g, attempt: event.attempt, writing: true, writingSince: now, codeSince: undefined, code: "", checking: undefined };
    case "code":
      return { ...g, code: g.code + event.text, codeSince: g.codeSince ?? now };
    case "draft": {
      let draft = g.draft;
      try {
        draft = loadGeneratedGame(event.source, `draft-${event.attempt}`, g.plan?.rules, g.plan?.title);
      } catch {
        // A draft that does not load keeps the last one on the table; the check will say why.
      }
      return { ...g, attempt: event.attempt, writing: false, draft };
    }
    case "checking":
      return { ...g, checking: { done: event.done, total: event.total } };
    case "checked": {
      const { type: _type, ...check } = event;
      return { ...g, checks: [...g.checks, check] };
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
  const idea = g.surprise ? 0.04 : 0;
  if (!g.idea) return 0.04 * (1 - Math.exp(-(now - g.started) / 3000));
  const planned = (g.plan ? 0.6 : 0) + (g.mechanics ? 0.4 : 0);
  if (!g.plan || !g.mechanics) return idea + (0.2 - idea) * Math.max(planned, 0.8 * (1 - Math.exp(-(now - g.started) / 9000)));
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
 * Makes a game from an idea (or a blank one, for a surprise), following each step as the server
 * reports it. Cancelling, or leaving the page, closes the stream, and the server stops the work.
 */
export function useGeneration(onReady: (game: GameModule) => void) {
  const [generation, setGeneration] = useState<Generation>();
  const controller = useRef<AbortController>(undefined);
  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(
    async (prompt: string, dials: Dials) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      const surprise = !prompt.trim();
      let g: Generation = { surprise, started: Date.now(), idea: surprise ? undefined : prompt.trim(), attempt: 0, writing: false, code: "", checks: [] };
      const update = (next: Generation) => {
        g = next;
        if (!abort.signal.aborted) setGeneration(next);
      };
      update(g);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: surprise ? "" : prompt, dials }),
          signal: abort.signal,
        });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? res.statusText);
        let result: GenerateResult | undefined;
        let failure: string | undefined;
        await readEvents(res, (event, data) => {
          if (event === "idea") update({ ...g, idea: data });
          else if (event === "design") update(apply(g, JSON.parse(data) as DesignEvent));
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
