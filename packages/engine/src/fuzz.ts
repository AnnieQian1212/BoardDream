import { playMatch, RuleViolation, type MatchResult, type TraceStep, type ViolationKind } from "./match";
import { resolveParams, sampleParams } from "./params";
import { createRng } from "./rng";
import type { GameModule, Params } from "./types";

export interface FuzzOptions {
  /** Random playouts to run. */
  runs?: number;
  seed?: number;
  maxTurns?: number;
  /** Share of runs at default params; the rest sample the whole parameter space. */
  defaultParamShare?: number;
  /** Runs replayed a second time to catch hidden nondeterminism such as Math.random. */
  determinismChecks?: number;
  /** Called before each run, e.g. so a watchdog can name the run that hangs. */
  onRun?(run: { index: number; seed: number; numPlayers: number; params: Params }): void;
}

export interface FuzzFailure {
  kind: ViolationKind;
  message: string;
  /** Replay with playMatch(game, { seed, numPlayers, params, strict: true }). */
  seed: number;
  numPlayers: number;
  params: Params;
  turn: number;
  /** Moves leading up to the failure, oldest first. */
  recentMoves: TraceStep[];
  /** Runs that hit the same failure. */
  count: number;
}

export interface FuzzReport {
  ok: boolean;
  runs: number;
  passed: number;
  /** Distinct failures, most frequent first. */
  failures: FuzzFailure[];
  avgTurns: number;
  maxTurns: number;
}

const RECENT_MOVES = 8;

/** Plays many random games in strict mode and groups every broken invariant it finds. */
export function fuzz(game: GameModule, opts: FuzzOptions = {}): FuzzReport {
  const { runs = 1000, seed = 1, maxTurns = 2000, defaultParamShare = 0.25, determinismChecks = 20 } = opts;
  const rng = createRng(seed);
  const failures = new Map<string, FuzzFailure>();
  let passed = 0;
  let totalTurns = 0;
  let longest = 0;

  for (let run = 0; run < runs; run++) {
    const runSeed = rng.int(2 ** 31);
    const numPlayers = game.meta.minPlayers + rng.int(game.meta.maxPlayers - game.meta.minPlayers + 1);
    const params = rng.next() < defaultParamShare ? resolveParams(game.params) : sampleParams(game.params, rng);
    const matchOpts = { numPlayers, params, seed: runSeed, maxTurns, strict: true };
    opts.onRun?.({ index: run, seed: runSeed, numPlayers, params });
    try {
      const result = playMatch(game, matchOpts);
      if (run < determinismChecks && fingerprint(playMatch(game, matchOpts)) !== fingerprint(result)) {
        throw new RuleViolation(
          "nondeterministic",
          "the same seed produced a different game; draw randomness only from the rng argument (no Math.random or Date)",
          0,
          [],
        );
      }
      passed++;
      totalTurns += result.turns;
      longest = Math.max(longest, result.turns);
    } catch (err) {
      const v = err instanceof RuleViolation ? err : new RuleViolation("threw", String(err), 0, []);
      // Group failures that differ only in numbers (seat ids, turn counts, coordinates).
      const key = `${v.kind}:${v.message.replace(/\d+/g, "#")}`;
      const existing = failures.get(key);
      if (existing) existing.count++;
      else {
        failures.set(key, {
          kind: v.kind,
          message: v.message,
          seed: runSeed,
          numPlayers,
          params,
          turn: v.turn,
          recentMoves: v.trace.slice(-RECENT_MOVES),
          count: 1,
        });
      }
    }
  }

  return {
    ok: failures.size === 0,
    runs,
    passed,
    failures: [...failures.values()].sort((a, b) => b.count - a.count),
    avgTurns: passed ? totalTurns / passed : 0,
    maxTurns: longest,
  };
}

const fingerprint = (result: MatchResult) => JSON.stringify([result.trace, result.outcome]);
