import { isDeck, type GameModule, type Geometry, type Panel } from "@boarddream/engine";
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
  /** The human's legal moves with nothing on the table to click (end turn, pass, a trade). */
  loose: unknown[];
  /** The move bar's buttons for them: see moveButtons. */
  buttons: MoveButton[];
  /** How a move reads to the human. */
  label(move: unknown): string;
  /** What a target is, as the player would call it. */
  kindOf(id: string): TargetKind | undefined;
  /** What to do this turn ("Click a glowing corner to settle"), when anything glows. */
  instruction?: string;
}

/** A button in the move bar: one move, or several of one kind behind a menu. */
/**
 * The status line while another seat moves: "Player 2 is thinking…", with the model that plays the
 * rivals when one does ("Player 2 (Muse Spark Open) is thinking…"), so a viewer can see it at work.
 */
export function thinkingLine(active: number | undefined, names?: (string | undefined)[], rivalModel?: string): string {
  if (active === undefined) return "";
  const name = names?.[active] ?? `Player ${active + 1}`;
  return `${name}${rivalModel ? ` (${rivalModel})` : ""} is thinking…`;
}

export interface MoveButton {
  label: string;
  moves: unknown[];
}

/** Beyond this many buttons, moves of one kind share a button. */
const BUTTONS = 5;

/** A move's kind: its `type` field, else the first word of how it reads. */
function kindKey(move: unknown, text: string): string {
  const type = move && typeof move === "object" && "type" in move ? (move as { type: unknown }).type : undefined;
  return typeof type === "string" && type ? type : (text.split(/\s/)[0] ?? text).toLowerCase();
}

/** "research_deck" or "tradeBridge" as a button reads it: "Research deck", "Trade bridge". */
function kindName(key: string): string {
  const words = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The move bar's buttons for moves with nothing on the table to click. Moves that read the same
 * are one button, since the player could not tell them apart (a trade listed once for every pair
 * of cards it could spend). When more than a handful remain, moves of one kind share a button
 * ("Offer…") that opens a menu of them, so the bar never becomes a wall of buttons.
 */
export function moveButtons(loose: unknown[], label: (move: unknown) => string): MoveButton[] {
  const distinct = new Map<string, unknown>();
  for (const move of loose) {
    const text = label(move);
    if (!distinct.has(text)) distinct.set(text, move);
  }
  const single = [...distinct].map(([text, move]) => ({ label: text, moves: [move] }));
  if (single.length <= BUTTONS) return single;
  const groups = new Map<string, MoveButton>();
  for (const button of single) {
    const key = kindKey(button.moves[0], button.label);
    const group = groups.get(key);
    if (group) group.moves.push(button.moves[0]);
    else groups.set(key, { label: button.label, moves: [button.moves[0]] });
  }
  return [...groups].map(([key, group]) => (group.moves.length === 1 ? group : { label: `${kindName(key)}…`, moves: group.moves }));
}

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
  return {
    active,
    over,
    mine,
    byTarget,
    targets: new Set(byTarget.keys()),
    loose,
    buttons: moveButtons(loose, label),
    label,
    kindOf: kind,
    instruction: mine ? instruction(glowing) : undefined,
  };
}
