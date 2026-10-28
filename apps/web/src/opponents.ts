import type { GameModule, Rng } from "@boarddream/engine";
import { tableBot } from "@boarddream/library";

/**
 * Muse Spark opponents. The local table bot plays the routine moves instantly; whenever the move it
 * would make is a social one (an offer, an answer to an offer, a bid, a claim, a call) Muse Spark
 * chooses among the social options instead and says a line of table talk. Any failure falls back
 * to the bot's move, so the game never stalls.
 */

const SOCIAL = /offer|trade|swap|deal|accept|decline|refuse|bid|claim|call|doubt|challenge|bluff|boast|raise|liar|vote|accuse/i;
const TIMEOUT_MS = 20_000;

export interface Decision {
  move: unknown;
  /** Table talk from Muse Spark, if it spoke. */
  say?: string;
}

const kindOf = (move: unknown) => (move !== null && typeof move === "object" && "type" in move ? String((move as { type: unknown }).type) : "");

/** What a seat can see, as plain lines: every seat's counters and cards, the shared supply, its own hand. */
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

export async function decide(
  game: GameModule,
  state: unknown,
  seat: number,
  numPlayers: number,
  recent: string[],
  rng: Rng,
  muse: boolean,
): Promise<Decision> {
  const moves = game.legalMoves(state, seat);
  const view = game.view ? game.view(state, seat) : state;
  const botMove = tableBot(game)({ game, state: view, player: seat, moves, rng });
  if (!muse) return { move: botMove };

  const describe = (move: unknown) => game.describeMove?.(state, move, seat) ?? JSON.stringify(move);
  const social = moves.filter((m) => SOCIAL.test(kindOf(m)) || SOCIAL.test(describe(m)));
  if (!social.includes(botMove)) return { move: botMove };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/opponent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        game: game.meta.name,
        rules: game.meta.rules ?? [game.meta.summary],
        seat,
        numPlayers,
        table: tableText(game, state, seat),
        recent: recent.slice(-8),
        moves: social.map(describe),
        advice: social.indexOf(botMove),
      }),
    });
    if (!res.ok) return { move: botMove };
    const reply = (await res.json()) as { move: number; say: string };
    return { move: social[reply.move] ?? botMove, say: reply.say?.trim() || undefined };
  } catch {
    return { move: botMove };
  } finally {
    clearTimeout(timer);
  }
}
