import { Worker } from "node:worker_threads";
import { fuzz, type FuzzFailure, type GameModule, type Params } from "@boarddream/engine";
import { loadGameFromSource } from "../sandbox";
import type { PlayStats } from "./playtest";

export interface RulesCheck {
  ok: boolean;
  loadError?: string;
  failures: FuzzFailure[];
  /** Set when a single game stopped making progress (an infinite loop) and the worker was killed. */
  stalled?: { seed: number; numPlayers: number; params: Params; afterMs: number };
  /** Set when the whole check ran out of time or memory. */
  aborted?: string;
  /** Random-play statistics, once the rules pass fuzzing. */
  play?: PlayStats;
  /** Design problems the playtest found in rules that work; see playIssues. */
  issues?: string[];
}

/** Loads generated rules and fuzzes them on this thread. Only for trusted or tiny inputs; see checkRulesIsolated. */
export function checkRules(source: string, runs: number): RulesCheck {
  let game: GameModule;
  try {
    game = loadGameFromSource(source);
  } catch (err) {
    return { ok: false, loadError: err instanceof Error ? err.message : String(err), failures: [] };
  }
  const report = fuzz(game, { runs });
  return { ok: report.ok, failures: report.failures };
}

export interface IsolatedOptions {
  runs: number;
  /** Kill the worker when one game makes no progress for this long. */
  stallMs?: number;
  /** Kill the worker when the whole check takes longer than this. */
  totalMs?: number;
  /** Heap cap for the worker, so runaway allocations cannot take the server down. */
  memoryMb?: number;
}

/** Messages from check-worker.ts. */
export type WorkerMessage =
  | { type: "run"; seed: number; numPlayers: number; params: Params }
  | { type: "done"; result: RulesCheck };

/**
 * Loads and fuzzes generated rules in a worker thread that is killed when a game hangs, the check
 * runs too long, or it runs out of memory. The report names the run that hung so it can be replayed.
 */
export function checkRulesIsolated(source: string, opts: IsolatedOptions): Promise<RulesCheck> {
  const { runs, stallMs = 10_000, totalMs = 180_000, memoryMb = 512 } = opts;
  return new Promise((resolve) => {
    const started = Date.now();
    let lastBeat = started;
    let current: Extract<WorkerMessage, { type: "run" }> | undefined;
    let settled = false;
    const worker = new Worker(new URL("./check-worker.ts", import.meta.url), {
      workerData: { source, runs },
      // The worker is TypeScript; load it through tsx whatever started this process.
      execArgv: ["--import", "tsx"],
      resourceLimits: { maxOldGenerationSizeMb: memoryMb },
    });
    const finish = (result: RulesCheck) => {
      if (settled) return;
      settled = true;
      clearInterval(watchdog);
      void worker.terminate();
      resolve(result);
    };
    const watchdog = setInterval(() => {
      const now = Date.now();
      if (current && now - lastBeat > stallMs) {
        const { seed, numPlayers, params } = current;
        finish({ ok: false, failures: [], stalled: { seed, numPlayers, params, afterMs: now - lastBeat } });
      } else if (now - started > totalMs) {
        finish({ ok: false, failures: [], aborted: `fuzzing did not finish within ${Math.round(totalMs / 1000)} s` });
      }
    }, Math.min(500, stallMs / 4));
    worker.on("message", (message: WorkerMessage) => {
      if (message.type === "run") {
        current = message;
        lastBeat = Date.now();
      } else finish(message.result);
    });
    worker.on("error", (err: Error) => finish({ ok: false, failures: [], aborted: `the rules crashed the checker: ${err.message}` }));
    worker.on("exit", (code) => finish({ ok: false, failures: [], aborted: `the checker exited early (code ${code})` }));
  });
}
