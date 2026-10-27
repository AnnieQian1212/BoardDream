import type { Rng } from "./rng";

export type PlayerId = number;

export type ParamValue = number | boolean | string;
export type Params = Record<string, ParamValue>;

/** A tunable value. Each one becomes a slider or toggle in the UI and an axis for balance sweeps. */
export type ParamSpec =
  | { key: string; label: string; kind: "int"; min: number; max: number; step?: number; default: number }
  | { key: string; label: string; kind: "bool"; default: boolean }
  | { key: string; label: string; kind: "choice"; options: string[]; default: string };

export type GameFamily = "grid" | "race" | "bluff";
export type PlayMode = "competitive" | "cooperative" | "hidden-role";

export interface GameMeta {
  id: string;
  name: string;
  family: GameFamily;
  mode: PlayMode;
  minPlayers: number;
  maxPlayers: number;
  summary: string;
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
  kind?: string;
  label?: string;
}

export interface GeometryPiece {
  id: string;
  x: number;
  y: number;
  r: number;
  owner?: PlayerId;
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

/**
 * The fixed interface every game implements: hand-written reference games and generated rules alike.
 *
 * Rules must be pure. Never mutate `state` (the fuzzer freezes it), keep states and moves
 * JSON-serializable, and draw all randomness from the `rng` argument.
 *
 * The runner applies one move per step, from the first entry of `activePlayers`. Games with
 * simultaneous moves store submitted moves in state, hide them in `view`, and drop the player
 * from `activePlayers` until the round resolves.
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
  geometry?(state: S): Geometry;
  /** Cell id a move acts on, so the UI can map board clicks to moves. */
  moveTarget?(state: S, move: M): string | undefined;
  /** Short label for logs, the move list and LLM players. */
  describeMove?(state: S, move: M): string;
}
