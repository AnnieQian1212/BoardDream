import type { GameModule, Rng } from "@boarddream/engine";
import { tableBot } from "./index";

/**
 * Language-model opponents: which moves are social (worth handing to the model), what a seat can
 * see written out as plain text, and the decision for a seat. The model call is a port (Chooser):
 * the web app posts to /api/opponent, the opponents benchmark calls the model directly, and tests
 * pass a fake, so all three run the same decision.
 */

/** One decision put to a model opponent: the server's /api/opponent takes exactly this. */
export interface OpponentRequest {
  game: string;
  rules: string[];
  seat: number;
  numPlayers: number;
  /** What the seat can see: scores, resources, cards, the market. */
  table: string;
  /** Recent moves, oldest first, as the seat saw them. */
  recent: string[];
  /** Legal moves, described from the seat's point of view. */
  moves: string[];
  /** Index of the move a quick calculation (the table bot) recommends. */
  advice?: number;
}

export interface OpponentReply {
  /** Index into the request's moves. */
  move: number;
  /** A line of table talk. */
  say: string;
}

/** Asks a model to choose among the social moves. Rejects (or throws) when it cannot. */
export type Chooser = (request: OpponentRequest) => Promise<OpponentReply>;

/** How many of the latest moves a model opponent is told about. */
export const HISTORY = 14;

export interface Decision {
  move: unknown;
  /** Table talk from the model, if it spoke. */
  say?: string;
  /** The model was asked: the bot's move was a social one. */
  asked: boolean;
  /** The model chose differently from the bot. */
  overruled: boolean;
  /** The model was asked but failed (an error, a timeout, a move out of range): the bot's move stands. */
  failed: boolean;
}

/**
 * The game's own bot's move for a seat, deciding from what that seat may see. It is one of `moves`
 * (the seat's legal moves, by default asked for here): moves are objects, so a caller that matches
 * it against a list must pass that list.
 */
export function botMove(game: GameModule, state: unknown, seat: number, rng: Rng, moves = game.legalMoves(state, seat)): unknown {
  const view = game.view ? game.view(state, seat) : state;
  return tableBot(game)({ game, state: view, player: seat, moves, rng });
}

/**
 * The move for a seat. The game's own bot plays routine moves; when the move it would make is a
 * social one (an offer, an answer to one, a bid, a claim, a call, a vote) and a chooser is given,
 * the model picks among the social options instead, with the bot's move as advice, and may talk.
 * Any failure keeps the bot's move, so the game never stalls. `history` is the moves as the seat
 * saw them, oldest first; the model hears the last HISTORY of them.
 */
export async function decideSeat(
  game: GameModule,
  state: unknown,
  seat: number,
  numPlayers: number,
  history: string[],
  rng: Rng,
  choose?: Chooser,
): Promise<Decision> {
  const moves = game.legalMoves(state, seat);
  const advice = botMove(game, state, seat, rng, moves);
  const plain: Decision = { move: advice, asked: false, overruled: false, failed: false };
  if (!choose) return plain;
  const social = socialMoves(game, state, seat, moves);
  if (!social.includes(advice)) return plain;
  const describe = (move: unknown) => game.describeMove?.(state, move, seat) ?? JSON.stringify(move);
  try {
    const reply = await choose({
      game: game.meta.name,
      rules: game.meta.rules ?? [game.meta.summary],
      seat,
      numPlayers,
      table: tableText(game, state, seat),
      recent: history.slice(-HISTORY),
      moves: social.map(describe),
      advice: social.indexOf(advice),
    });
    const move = Number.isInteger(reply.move) ? social[reply.move] : undefined;
    if (move === undefined) return { ...plain, asked: true, failed: true };
    return { move, say: reply.say?.trim() || undefined, asked: true, overruled: move !== advice, failed: false };
  } catch {
    return { ...plain, asked: true, failed: true };
  }
}

const SOCIAL = /offer|trade|swap|deal|accept|decline|refuse|bid|claim|call|doubt|challenge|bluff|boast|raise|liar|vote|accuse|vouch|quiet|abstain/i;

const kindOf = (move: unknown) => (move !== null && typeof move === "object" && "type" in move ? String((move as { type: unknown }).type) : "");

/** Moves where talking, reading people and bluffing matter: offers and answers, bids, claims, calls, votes. */
export function socialMoves(game: GameModule, state: unknown, seat: number, moves: unknown[]): unknown[] {
  const describe = (move: unknown) => game.describeMove?.(state, move, seat) ?? JSON.stringify(move);
  return moves.filter((m) => SOCIAL.test(kindOf(m)) || SOCIAL.test(describe(m)));
}

/** What a seat can see, as plain lines: every seat's counters and cards, the shared supply, its own hand, board text. */
export function tableText(game: GameModule, state: unknown, seat: number): string {
  const lines: string[] = [];
  for (const panel of game.panels?.(state, seat) ?? []) {
    const who = panel.zone === "players" ? (panel.owner === seat ? `${panel.title} (you)` : panel.title) : panel.title;
    const counters = (panel.counters ?? []).map((c) => `${c.label} ${c.value}`).join(", ");
    const cards = (panel.cards ?? []).map((c) => (c.faceDown ? "face-down card" : c.text ? `${c.title} (${c.text})` : c.title)).join("; ");
    lines.push(`${who}: ${[counters, cards && `cards: ${cards}`, panel.note].filter(Boolean).join(" | ")}`);
  }
  // Board games carry claims, bids and round info in text-only cells, and dice or ranks on pieces.
  const geometry = game.geometry?.(state, seat);
  for (const cell of geometry?.cells ?? []) if (cell.kind === "label" && cell.label) lines.push(cell.label);
  const pieces = new Map<number, string[]>();
  for (const piece of geometry?.pieces ?? []) {
    if (piece.label === undefined || piece.owner === undefined) continue;
    pieces.set(piece.owner, [...(pieces.get(piece.owner) ?? []), piece.label]);
  }
  for (const [owner, labels] of pieces) lines.push(`${owner === seat ? "Your" : `P${owner + 1}'s`} pieces: ${labels.join(" ")}`);
  return lines.join("\n") || game.meta.summary;
}
