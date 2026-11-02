import { createRng, type GameModule, type Params, type Rng } from "@boarddream/engine";

/**
 * A game being played at the table: its state, the moves made so far and who acts next. Every
 * function returns a new Match and none knows how the table draws a move, so the whole of a match
 * (bots, Muse opponents, draft previews, what each seat may know) can be tested without React.
 */

/** A logged move, with the state it was made from so each seat can have it described from its own view. */
export interface MatchEntry {
  id: number;
  seat: number;
  /** The move as the table's viewer saw it. */
  text: string;
  /** What the player said while making it (Muse Spark opponents). */
  say?: string;
  before: unknown;
  move: unknown;
}

export interface Match {
  /** Each new match gets its own table, so nothing carries over from the last (floating changes). */
  id: number;
  game: GameModule;
  numPlayers: number;
  params: Params;
  /** Whose eyes the log is written for: the human's seat, so rivals' hidden cards stay hidden. */
  viewer: number;
  state: unknown;
  rng: Rng;
  log: MatchEntry[];
}

/** Moves the log keeps; older ones fall off. */
export const LOG_LIMIT = 60;
/** How many of the latest moves a line of table talk stays on show for. */
const SPEECH_MOVES = 4;

let started = 0;

export function startMatch(game: GameModule, numPlayers: number, params: Params, viewer: number, seed = Date.now() >>> 0): Match {
  const rng = createRng(seed);
  return { id: ++started, game, numPlayers, params, viewer, state: game.setup({ numPlayers, params, rng }), rng, log: [] };
}

/** The same game again, from the start. */
export const restartMatch = (match: Match, seed?: number) => startMatch(match.game, match.numPlayers, match.params, match.viewer, seed);

const describe = (match: Match, before: unknown, move: unknown, seat: number) => match.game.describeMove?.(before, move, seat) ?? JSON.stringify(move);

/** The match after `seat` makes `move`, logged as the viewer saw it, with what they said. */
export function playMove(match: Match, seat: number, move: unknown, say?: string): Match {
  const text = describe(match, match.state, move, match.viewer);
  const state = match.game.applyMove(match.state, seat, move, match.rng);
  const id = (match.log.at(-1)?.id ?? 0) + 1;
  return { ...match, state, log: [...match.log.slice(-(LOG_LIMIT - 1)), { id, seat, text, say, before: match.state, move }] };
}

export const isOver = (match: Match) => match.game.isTerminal(match.state);

/** The seat to act now, or undefined once the game is over. */
export function nextSeat(match: Match): number | undefined {
  return isOver(match) ? undefined : match.game.activePlayers(match.state)[0];
}

/**
 * The moves so far as `seat` saw them, for an opponent deciding in that seat: its own moves as
 * "You ...", rivals' as "P2 ...", with what each said, and nothing it could not see (a rival's
 * face-down cards are described from `seat`'s view).
 */
export function historyFor(match: Match, seat: number): string[] {
  return match.log.map((e) => `${e.seat === seat ? "You" : `P${e.seat + 1}`} ${describe(match, e.before, e.move, seat)}${e.say ? ` ("${e.say}")` : ""}`);
}

/** The latest line of table talk among the last few moves, to show at the speaker's seat. */
export function latestSpeech(match: Match): { id: number; seat: number; text: string } | undefined {
  const spoken = match.log.slice(-SPEECH_MOVES).findLast((e) => e.say);
  return spoken && { id: spoken.id, seat: spoken.seat, text: spoken.say! };
}

/** The battle on the board in a state, if any: its id changes with every battle. */
function battleOf(match: Match, state: unknown): string | undefined {
  try {
    return match.game.geometry?.(state, match.viewer)?.battle?.id;
  } catch {
    return undefined;
  }
}

/** Whether the last move fought a new battle, which the table plays out before the next move. */
export function battleStarted(match: Match): boolean {
  const last = match.log.at(-1);
  if (!last) return false;
  const now = battleOf(match, match.state);
  return now !== undefined && now !== battleOf(match, last.before);
}

/**
 * One random legal move by the seat to act, for bots playing a draft while it is checked; a
 * finished game starts again. Throws what the rules throw: a draft may still have bugs.
 */
export function randomStep(match: Match): Match {
  if (isOver(match)) return restartMatch(match);
  const seat = nextSeat(match)!;
  return playMove(match, seat, match.rng.pick(match.game.legalMoves(match.state, seat)));
}
