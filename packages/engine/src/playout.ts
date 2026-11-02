import { resolveParams } from "./params";
import { createRng } from "./rng";
import type { GameModule, Params, PlayerId } from "./types";

/**
 * Random games for looking at what a game shows: the cards it deals, how far its board reaches,
 * how many real choices a turn offers. The bots and the fuzzer play their own way; this is for the
 * tools that only need a game to happen.
 */

/** Seats for a look at a game: three when it allows, so a table has rivals on both sides. */
export const sampleSeats = (game: GameModule) => Math.min(game.meta.maxPlayers, Math.max(game.meta.minPlayers, 3));

/** One turn of a random game: the state before the move, who moved, what they could do and what they did. */
export interface PlayoutTurn {
  turn: number;
  state: unknown;
  seat: PlayerId;
  moves: unknown[];
  move: unknown;
}

export interface PlayoutOptions {
  numPlayers?: number;
  seed: number;
  /** Stop after this many turns if the game has not ended. */
  maxTurns: number;
  params?: Params;
}

/**
 * Plays one random game: from setup, the first active seat plays a random legal move until the game
 * ends or maxTurns pass. `visit` sees each turn before its move and returns false to stop early.
 * Returns the last state. The same seed always plays the same game.
 */
export function randomPlayout(game: GameModule, opts: PlayoutOptions, visit?: (turn: PlayoutTurn) => false | void): unknown {
  const numPlayers = opts.numPlayers ?? sampleSeats(game);
  const rng = createRng(opts.seed);
  let state = game.setup({ numPlayers, params: opts.params ?? resolveParams(game.params), rng });
  for (let turn = 0; turn < opts.maxTurns && !game.isTerminal(state); turn++) {
    const [seat] = game.activePlayers(state);
    const moves = game.legalMoves(state, seat);
    const move = rng.pick(moves);
    if (visit?.({ turn, state, seat, moves, move }) === false) break;
    state = game.applyMove(state, seat, move, rng);
  }
  return state;
}
