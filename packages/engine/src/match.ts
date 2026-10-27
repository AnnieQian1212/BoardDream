import { resolveParams } from "./params";
import { createRng, type Rng } from "./rng";
import type { GameModule, Outcome, Params, PlayerId } from "./types";

/** Picks a move for `player`. `state` is that player's view when the game defines one. */
export type Bot = (args: { game: GameModule; state: unknown; player: PlayerId; moves: unknown[]; rng: Rng }) => unknown;

export const randomBot: Bot = ({ moves, rng }) => rng.pick(moves);

export type ViolationKind =
  | "threw"
  | "mutated-state"
  | "no-active-player"
  | "no-legal-moves"
  | "not-serializable"
  | "bad-outcome"
  | "no-termination"
  | "nondeterministic";

export interface TraceStep {
  turn: number;
  player: PlayerId;
  move: unknown;
}

/** A broken rule invariant, with enough context to replay it and to explain it to the repair model. */
export class RuleViolation extends Error {
  constructor(
    readonly kind: ViolationKind,
    message: string,
    readonly turn: number,
    readonly trace: TraceStep[],
  ) {
    super(message);
    this.name = "RuleViolation";
  }
}

export interface MatchOptions {
  numPlayers: number;
  params?: Params;
  seed?: number;
  /** One bot per seat; seats without a bot play randomly. */
  bots?: Bot[];
  /** Turn cap. Hitting it is a violation in strict mode and a truncated draw otherwise. */
  maxTurns?: number;
  /** Check rule invariants at every step (the fuzzer's mode). Slower. */
  strict?: boolean;
}

export interface MatchResult {
  outcome: Outcome;
  turns: number;
  trace: TraceStep[];
  finalState: unknown;
  truncated: boolean;
}

const MUTATION_ERROR = /read[- ]only|not extensible|Cannot (assign|add|delete|define)/i;

export function playMatch(game: GameModule, opts: MatchOptions): MatchResult {
  const { numPlayers, seed = 1, maxTurns = 1000, strict = false } = opts;
  const params = resolveParams(game.params, opts.params);
  const rng = createRng(seed);
  const botRng = rng.fork();
  const trace: TraceStep[] = [];
  let turn = 0;

  const violation = (kind: ViolationKind, message: string) => new RuleViolation(kind, message, turn, trace.slice());
  const call = <T>(method: string, fn: () => T): T => {
    try {
      return fn();
    } catch (err) {
      if (err instanceof RuleViolation) throw err;
      const message = err instanceof Error ? err.message : String(err);
      if (strict && MUTATION_ERROR.test(message)) {
        throw violation("mutated-state", `${method} mutated a frozen state or move; return new objects instead: ${message}`);
      }
      throw violation("threw", `${method} threw: ${message}`);
    }
  };
  // In strict mode every state and move list must be plain JSON, and is frozen so in-place edits throw.
  const checkJson = (value: unknown, path: string) => {
    if (!strict) return;
    const problem = findNonJson(value, path);
    if (problem) throw violation("not-serializable", problem);
    deepFreeze(value);
  };

  let state = call("setup", () => game.setup({ numPlayers, params, rng }));
  checkJson(state, "state");

  while (!call("isTerminal", () => game.isTerminal(state))) {
    if (turn >= maxTurns) {
      if (strict) throw violation("no-termination", `game did not end within ${maxTurns} turns`);
      return { outcome: { winners: [] }, turns: turn, trace, finalState: state, truncated: true };
    }
    const active = call("activePlayers", () => game.activePlayers(state));
    if (!Array.isArray(active) || active.length === 0) {
      throw violation("no-active-player", "isTerminal() is false but activePlayers() returned no players");
    }
    const player = active[0];
    const moves = call("legalMoves", () => game.legalMoves(state, player));
    if (!Array.isArray(moves) || moves.length === 0) {
      throw violation("no-legal-moves", `player ${player} must act but legalMoves() is empty; add a pass move or end the game`);
    }
    checkJson(moves, "legalMoves()");
    const view = game.view ? call("view", () => game.view!(state, player)) : state;
    const bot = opts.bots?.[player] ?? randomBot;
    const move = bot({ game, state: view, player, moves, rng: botRng });
    trace.push({ turn, player, move });
    state = call("applyMove", () => game.applyMove(state, player, move, rng));
    checkJson(state, "state");
    turn++;
  }

  const outcome = call("outcome", () => game.outcome(state));
  if (strict) {
    const problem = checkOutcome(outcome, numPlayers);
    if (problem) throw violation("bad-outcome", problem);
  }
  return { outcome, turns: turn, trace, finalState: state, truncated: false };
}

/** Path and reason for the first value JSON cannot round-trip, or null if it all can. */
export function findNonJson(value: unknown, path: string): string | null {
  if (value === null || typeof value === "string" || typeof value === "boolean") return null;
  if (typeof value === "number") return Number.isFinite(value) ? null : `${path} is ${value}, which JSON cannot represent`;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const problem = value[i] === undefined ? `${path}[${i}] is undefined` : findNonJson(value[i], `${path}[${i}]`);
      if (problem) return problem;
    }
    return null;
  }
  if (typeof value === "object") {
    // Accept plain objects from any realm: generated rules run in their own vm context.
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && Object.getPrototypeOf(proto) !== null) {
      const name = (value as { constructor?: { name?: string } }).constructor?.name ?? "class instance";
      return `${path} is a ${name}; use plain objects and arrays`;
    }
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) continue;
      const problem = findNonJson(child, `${path}.${key}`);
      if (problem) return problem;
    }
    return null;
  }
  return `${path} is ${value === undefined ? "undefined" : `a ${typeof value}`}`;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
}

function checkOutcome(outcome: Outcome, numPlayers: number): string | null {
  if (!outcome || !Array.isArray(outcome.winners)) return "outcome() must return { winners: PlayerId[] }";
  const seen = new Set<number>();
  for (const winner of outcome.winners) {
    if (!Number.isInteger(winner) || winner < 0 || winner >= numPlayers) {
      return `outcome().winners contains ${JSON.stringify(winner)}, which is not a seat in 0..${numPlayers - 1}`;
    }
    if (seen.has(winner)) return `outcome().winners lists player ${winner} twice`;
    seen.add(winner);
  }
  if (outcome.scores && outcome.scores.length !== numPlayers) {
    return `outcome().scores has ${outcome.scores.length} entries for ${numPlayers} players`;
  }
  return null;
}
