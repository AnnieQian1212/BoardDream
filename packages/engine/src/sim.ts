import { playMatch, type Bot } from "./match";
import type { GameModule, ParamValue, Params } from "./types";

export interface SimOptions {
  numPlayers: number;
  params?: Params;
  games?: number;
  seed?: number;
  bots?: Bot[];
  maxTurns?: number;
  /** Called with each game's seed before it starts (heartbeats for a watchdog). */
  onGame?(seed: number): void;
}

export interface BalanceStats {
  games: number;
  /** Share of games each seat won; shared and team wins count for every winner. */
  winRateBySeat: number[];
  drawRate: number;
  /**
   * Seat 0 win rate minus the seats' average, which is 1/numPlayers when every game has one winner
   * and differs with draws, shared wins or team games. Positive means a first-player advantage.
   */
  firstPlayerEdge: number;
  avgTurns: number;
  medianTurns: number;
  /** Games stopped at maxTurns, counted as draws. */
  truncatedRate: number;
  errors: number;
  firstError?: string;
}

export function simulate(game: GameModule, opts: SimOptions): BalanceStats {
  const { numPlayers, params, games = 200, seed = 1, bots, maxTurns = 1000, onGame } = opts;
  const wins = new Array<number>(numPlayers).fill(0);
  const turns: number[] = [];
  let draws = 0;
  let truncated = 0;
  let errors = 0;
  let firstError: string | undefined;

  for (let i = 0; i < games; i++) {
    onGame?.(seed + i);
    try {
      const result = playMatch(game, { numPlayers, params, seed: seed + i, bots, maxTurns });
      turns.push(result.turns);
      if (result.truncated) truncated++;
      if (result.outcome.winners.length === 0) draws++;
      for (const winner of result.outcome.winners) wins[winner]++;
    } catch (err) {
      errors++;
      firstError ??= err instanceof Error ? err.message : String(err);
    }
  }

  const played = Math.max(1, turns.length);
  const sorted = turns.slice().sort((a, b) => a - b);
  return {
    games: turns.length,
    winRateBySeat: wins.map((w) => w / played),
    drawRate: draws / played,
    firstPlayerEdge: wins[0] / played - wins.reduce((a, b) => a + b, 0) / played / numPlayers,
    avgTurns: turns.reduce((a, b) => a + b, 0) / played,
    medianTurns: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
    truncatedRate: truncated / played,
    errors,
    firstError,
  };
}

/** Balance stats at each value of one parameter, with the other parameters held fixed. */
export function sweepParam(game: GameModule, key: string, values: readonly ParamValue[], opts: SimOptions) {
  return values.map((value) => ({ value, stats: simulate(game, { ...opts, params: { ...opts.params, [key]: value } }) }));
}
