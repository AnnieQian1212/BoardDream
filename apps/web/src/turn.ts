import type { Counter, GameModule, Geometry, Panel } from "@boarddream/engine";
import { instruction, type TargetKind } from "./instructions";

/**
 * A turn as either table shows it: whose turn it is, what the human can click and what each click
 * does, the moves shown as buttons instead, how every move reads, and what to tell the player.
 * The 3D table and the flat one both draw from it, so they cannot disagree about what glows or
 * what it is called.
 */
export interface Turn {
  /** The seat to act, or undefined once the game is over. */
  active?: number;
  over: boolean;
  /** It is the human's turn. */
  mine: boolean;
  /** The human's legal moves by the id of the board cell, card or counter each acts on. */
  byTarget: Map<string, unknown[]>;
  targets: Set<string>;
  /** The human's legal moves with nothing on the table to click: buttons (end turn, pass). */
  loose: unknown[];
  /** How a move reads to the human. */
  label(move: unknown): string;
  /** What a target is, as the player would call it. */
  kindOf(id: string): TargetKind | undefined;
  /** What to do this turn ("Click a glowing corner to settle"), when anything glows. */
  instruction?: string;
}

/** A shared counter that counts a stack of cards: drawn as a face-down deck, not a chip. */
export const isDeck = (c: Counter) => !c.resource && /deck|draw|pile|stack/i.test(c.label);

/**
 * What an id the moves point at is on the table: a board cell (corner, edge or space), a card, a
 * resource pile, a deck or another counter. Label cells are print, never something to click.
 */
export function kindOf(id: string, panels: Panel[], geometry: Geometry | undefined): TargetKind | undefined {
  const cell = geometry?.cells.find((c) => c.id === id);
  if (cell) return cell.kind === "label" ? undefined : cell.kind === "vertex" ? "corner" : cell.kind === "edge" ? "edge" : "space";
  for (const panel of panels) {
    if (panel.cards?.some((c) => c.id === id)) return "card";
    const counter = panel.counters?.find((c) => c.id === id);
    if (counter) return counter.resource ? "pile" : panel.zone === "shared" && isDeck(counter) ? "deck" : "counter";
  }
  return undefined;
}

/** The turn in `state`, seen from the human's seat, given what the table shows (its panels and board). */
export function turnOf(game: GameModule, state: unknown, human: number, panels: Panel[], geometry: Geometry | undefined): Turn {
  const over = game.isTerminal(state);
  const active = over ? undefined : game.activePlayers(state)[0];
  const mine = active === human;
  const label = (move: unknown) => game.describeMove?.(state, move, human) ?? JSON.stringify(move);
  const byTarget = new Map<string, unknown[]>();
  const loose: unknown[] = [];
  for (const move of mine ? game.legalMoves(state, human) : []) {
    const target = game.moveTarget?.(state, move);
    if (target === undefined) loose.push(move);
    else byTarget.set(target, [...(byTarget.get(target) ?? []), move]);
  }
  const kind = (id: string) => kindOf(id, panels, geometry);
  const glowing = [...byTarget.entries()].flatMap(([id, moves]) => {
    const k = kind(id);
    return k ? moves.map((move) => ({ kind: k, description: label(move) })) : [];
  });
  return { active, over, mine, byTarget, targets: new Set(byTarget.keys()), loose, label, kindOf: kind, instruction: mine ? instruction(glowing) : undefined };
}
