import { availableParallelism } from "node:os";
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
  /** Kill a worker when one game makes no progress for this long. */
  stallMs?: number;
  /** Give up when the whole check takes longer than this. */
  totalMs?: number;
  /** Heap cap for each worker, so runaway allocations cannot take the server down. */
  memoryMb?: number;
  /** Workers the fuzzing runs are shared among; by default one per spare core, at most four. */
  workers?: number;
  /** Called as fuzzing runs and playtest games start, with how many of about how many in all. */
  onProgress?(done: number, total: number): void;
  /** Stops the check early, e.g. when the player who asked for the game has left. */
  signal?: AbortSignal;
}

/** What one worker does: fuzz a share of the runs from its own seed, or playtest rules that passed. */
export type WorkerTask = { kind: "fuzz"; runs: number; seed: number } | { kind: "playtest" };

/** Messages from check-worker.ts. */
export type WorkerMessage =
  | { type: "run"; seed: number; numPlayers: number; params: Params }
  | { type: "done"; result: RulesCheck };

/** Games the playtest plays (playtest.ts): random games, then the planner's, for the progress count. */
const PLAYTEST_GAMES = 130;

/**
 * Loads and fuzzes generated rules in worker threads, which are killed when a game hangs, the
 * check runs too long, or one runs out of memory. The runs are shared among several workers so
 * a check takes seconds, and the playtest runs beside them, counting only if they all pass. The
 * report names the run that hung so it can be replayed.
 */
export async function checkRulesIsolated(source: string, opts: IsolatedOptions): Promise<RulesCheck> {
  const { runs, totalMs = 180_000, workers = Math.max(1, Math.min(4, availableParallelism() - 1)), onProgress, signal } = opts;
  const deadline = Date.now() + totalMs;
  const total = runs + PLAYTEST_GAMES;
  let done = 0;
  const beat = () => onProgress?.(++done, total);
  const shards = Math.max(1, Math.min(workers, Math.ceil(runs / 50)));
  const tasks: WorkerTask[] = Array.from({ length: shards }, (_, i) => ({
    kind: "fuzz",
    runs: Math.floor(runs / shards) + (i < runs % shards ? 1 : 0),
    seed: i + 1,
  }));
  return runWorkers(source, [...tasks, { kind: "playtest" }], { ...opts, deadline, beat, signal });
}

/**
 * Runs the tasks in parallel workers. Every fuzzing worker finishes and their failures are merged
 * in order, so the same rules always get the same report (and the same repair request), whichever
 * worker happened to be quickest. The playtest's result, good or bad, waits for fuzzing, whose
 * failures name the run to replay and so say more about broken rules than a playtest that tripped.
 */
function runWorkers(
  source: string,
  tasks: WorkerTask[],
  opts: { stallMs?: number; memoryMb?: number; deadline: number; beat(): void; signal?: AbortSignal; totalMs?: number },
): Promise<RulesCheck> {
  const { stallMs = 10_000, memoryMb = 512, deadline, beat, signal, totalMs = 180_000 } = opts;
  return new Promise((resolve) => {
    let settled = false;
    const results: (RulesCheck | undefined)[] = tasks.map(() => undefined);
    const fuzzing = tasks.flatMap((task, i) => (task.kind === "fuzz" ? [i] : []));
    const playtest = tasks.findIndex((task) => task.kind === "playtest");
    const running = tasks.map((task, index) => {
      const state = {
        lastBeat: Date.now(),
        current: undefined as Extract<WorkerMessage, { type: "run" }> | undefined,
        reported: false,
        // A planner game in heavy rules can take many seconds without being stuck; fuzzing has
        // already looked for games that never end.
        stallMs: task.kind === "playtest" ? Math.max(stallMs, 60_000) : stallMs,
      };
      const report = (result: RulesCheck) => {
        if (state.reported) return;
        state.reported = true;
        results[index] = result;
        if (fuzzing.some((i) => !results[i])) return;
        const broken = fuzzing.map((i) => results[i]!).filter((r) => !r.ok);
        if (broken.length > 0) finish(merge(broken));
        else if (playtest < 0) finish(results[fuzzing[0]]!);
        else if (results[playtest]) finish(results[playtest]!);
      };
      const worker = new Worker(new URL("./check-worker.ts", import.meta.url), {
        workerData: { source, task },
        // The worker is TypeScript; load it through tsx whatever started this process.
        execArgv: ["--import", "tsx"],
        resourceLimits: { maxOldGenerationSizeMb: memoryMb },
      });
      worker.on("message", (message: WorkerMessage) => {
        if (message.type === "run") {
          state.current = message;
          state.lastBeat = Date.now();
          beat();
        } else report(message.result);
      });
      worker.on("error", (err: Error) => report({ ok: false, failures: [], aborted: `the rules crashed the checker: ${err.message}` }));
      // A worker that exits after its report is done; one that exits before it died.
      worker.on("exit", () => report({ ok: false, failures: [], aborted: "the checker exited early" }));
      return { worker, state };
    });
    const onAbort = () => finish({ ok: false, failures: [], aborted: "the check was cancelled" });
    signal?.addEventListener("abort", onAbort);
    const watchdog = setInterval(() => {
      const now = Date.now();
      for (const { state } of running) {
        if (!state.reported && state.current && now - state.lastBeat > state.stallMs) {
          const { seed, numPlayers, params } = state.current;
          return finish({ ok: false, failures: [], stalled: { seed, numPlayers, params, afterMs: now - state.lastBeat } });
        }
      }
      if (now > deadline) finish({ ok: false, failures: [], aborted: `fuzzing did not finish within ${Math.round(totalMs / 1000)} s` });
    }, Math.min(500, stallMs / 4));
    function finish(result: RulesCheck) {
      if (settled) return;
      settled = true;
      clearInterval(watchdog);
      signal?.removeEventListener("abort", onAbort);
      for (const { worker } of running) void worker.terminate();
      resolve(result);
    }
    if (signal?.aborted) onAbort();
  });
}

/** One report from several workers' failed checks, in worker order: like failures grouped together. */
function merge(broken: RulesCheck[]): RulesCheck {
  const fatal = broken.find((r) => r.loadError || r.stalled || r.aborted);
  if (fatal) return fatal;
  const grouped = new Map<string, FuzzFailure>();
  for (const failure of broken.flatMap((r) => r.failures)) {
    const key = `${failure.kind}:${failure.message.replace(/\d+/g, "#")}`;
    const seen = grouped.get(key);
    if (seen) seen.count += failure.count;
    else grouped.set(key, { ...failure });
  }
  return { ok: false, failures: [...grouped.values()].sort((a, b) => b.count - a.count) };
}
