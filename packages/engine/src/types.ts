import type { Rng } from "./rng";

export type PlayerId = number;

export type ParamValue = number | boolean | string;
export type Params = Record<string, ParamValue>;

/** A tunable value. Each one becomes a slider or toggle in the UI and an axis for balance sweeps. */
export type ParamSpec =
  | { key: string; label: string; kind: "int"; min: number; max: number; step?: number; default: number }
  | { key: string; label: string; kind: "bool"; default: boolean }
  | { key: string; label: string; kind: "choice"; options: string[]; default: string };

export type GameFamily = "grid" | "race" | "bluff" | "engine" | "map";
export type PlayMode = "competitive" | "cooperative" | "hidden-role";

/**
 * A resource the game counts. `icon` names one of the renderer's built-in icons, e.g. "droplet",
 * "sun", "sprout", "trees", "mountain", "wheat", "brick", "coins", "gem", "fish", "star".
 */
export interface ResourceSpec {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface GameMeta {
  id: string;
  name: string;
  family: GameFamily;
  mode: PlayMode;
  minPlayers: number;
  maxPlayers: number;
  summary: string;
  /** The rules in a few short sentences, for players and for AI opponents. */
  rules?: string[];
  resources?: ResourceSpec[];
}

export interface SetupContext<P extends Params = Params> {
  numPlayers: number;
  params: P;
  rng: Rng;
}

/**
 * End-of-game result. Empty `winners` means a draw, or in a cooperative game that the table lost.
 * Cooperative wins list every player; team wins list the whole winning team.
 */
export interface Outcome {
  winners: PlayerId[];
  scores?: number[];
}

export interface GeometryCell {
  id: string;
  polygon: [number, number][];
  /** Tints the cell in this player's color, e.g. a start square or a seat. */
  owner?: PlayerId;
  /** "label" cells are text only: no fill, no outline, not clickable. */
  kind?: string;
  label?: string;
}

export interface GeometryPiece {
  id: string;
  x: number;
  y: number;
  r: number;
  owner?: PlayerId;
  /** "pawn" is a standing figure, e.g. a worker on an action space. */
  shape?: "disc" | "square" | "pawn";
  kind?: string;
  label?: string;
  cellId?: string;
}

/** Board layout in abstract units. Drives the SVG renderer and is the ground truth for art alignment. */
export interface Geometry {
  width: number;
  height: number;
  cells: GeometryCell[];
  pieces: GeometryPiece[];
}

/** A card as the UI draws it. */
export interface CardView {
  id: string;
  title: string;
  /** Rules text. */
  text?: string;
  /** Resource id to amount. */
  cost?: Record<string, number>;
  points?: number;
  /** Suits, types or habitats; the first tag picks the card's accent color. */
  tags?: string[];
  faceDown?: boolean;
  /** Card illustration; filled in by the art pipeline. */
  art?: string;
}

export interface Counter {
  id: string;
  label: string;
  value: number;
  /** Resource id, for its icon and color. */
  resource?: string;
}

/**
 * A block of non-board UI. "players" panels are each seat's area (resources, tableau), "shared" ones
 * sit in the middle (market, supply), and "hand" holds the viewer's private cards.
 */
export interface Panel {
  id: string;
  title: string;
  zone: "players" | "shared" | "hand";
  owner?: PlayerId;
  counters?: Counter[];
  cards?: CardView[];
  note?: string;
}

/**
 * The fixed interface every game implements: hand-written reference games and generated rules alike.
 *
 * Rules must be pure. Never mutate `state` (the fuzzer freezes it), keep states and moves
 * JSON-serializable, and draw all randomness from the `rng` argument.
 *
 * The runner applies one move per step, from the first entry of `activePlayers`. Games with
 * simultaneous moves store submitted moves in state, hide them in `view`, and drop the player
 * from `activePlayers` until the round resolves.
 *
 * The fuzzer also exercises `geometry`, `moveTarget` and `describeMove`, because the UI calls them.
 */
export interface GameModule<S = any, M = any, P extends Params = any> {
  meta: GameMeta;
  params: ParamSpec[];
  setup(ctx: SetupContext<P>): S;
  /** Players who may act now. Empty only once the game is over. */
  activePlayers(state: S): PlayerId[];
  legalMoves(state: S, player: PlayerId): M[];
  applyMove(state: S, player: PlayerId, move: M, rng: Rng): S;
  isTerminal(state: S): boolean;
  outcome(state: S): Outcome;
  /** What `player` may see. Hidden-information games must redact other players' secrets here. */
  view?(state: S, player: PlayerId): unknown;
  /** Board layout. With a `viewer`, draw only what that player may see (hidden dice, cards, roles). */
  geometry?(state: S, viewer?: PlayerId): Geometry;
  /** Player areas, hands, markets and supplies. With a `viewer`, show only what that player may see. */
  panels?(state: S, viewer?: PlayerId): Panel[];
  /**
   * Id of the geometry cell, panel card or counter a move acts on, so clicks map to moves. Several
   * moves may share a target (play or discard a card); the UI then offers a choice.
   */
  moveTarget?(state: S, move: M): string | undefined;
  /**
   * Short label for logs, the move list and LLM players. With a `viewer` other than the mover, say
   * only what that viewer may know (a rival's face-down card stays hidden).
   */
  describeMove?(state: S, move: M, viewer?: PlayerId): string;
}
