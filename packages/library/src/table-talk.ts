import type { GameModule } from "@boarddream/engine";

/**
 * Helpers for language-model opponents: which moves are social (worth handing to the model) and
 * what a seat can see, written out as plain text.
 */

const SOCIAL = /offer|trade|swap|deal|accept|decline|refuse|bid|claim|call|doubt|challenge|bluff|boast|raise|liar|vote|accuse/i;

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
