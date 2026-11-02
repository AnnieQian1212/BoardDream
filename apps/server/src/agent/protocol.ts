import type { FuzzFailure, GameFamily, GameMeta, Params, PlayMode } from "@boarddream/engine";

/**
 * What the server and the web app say to each other about making a game: the dials a player sets,
 * the plan, each step of the design as it streams (DesignEvent), the playtest's statistics, and
 * the result of making or revising a game. Types only, with nothing from Node, so the web app
 * reads this file itself instead of keeping copies that drift.
 */

/** How much players get in each other's way. */
export type Interaction = "gentle" | "some" | "cutthroat";
/** The genre of a game's setting. */
export type Theme = "nature" | "history" | "fantasy" | "scifi";

/** The dials on the create screen. The optional ones are left to the designer when absent. */
export interface Dials {
  minPlayers: number;
  maxPlayers: number;
  playMinutes: number;
  /** 1 (gateway hobby game) to 5 (heavy strategy game). */
  complexity: number;
  /** 0 = pure strategy, 1 = pure luck. */
  luck: number;
  mode: PlayMode;
  family?: Exclude<GameFamily, "race">;
  interaction?: Interaction;
  /** For Surprise me, and for ideas that name no setting. */
  theme?: Theme;
  /** Library mechanics (catalog ids) to build the game around, at most three. */
  mustUse?: string[];
}

/** What a game made earlier was like: its name, family, the shape of its table and its core mechanics. */
export interface RecentGame {
  title: string;
  family: string;
  board: string;
  mechanics?: string[];
}

/** The designer's plan for a game, written before any rules code. */
export interface GameSpec {
  title: string;
  pitch: string;
  family: GameFamily;
  mode: PlayMode;
  minPlayers: number;
  maxPlayers: number;
  /**
   * The shape of the table, chosen from the setting: a hex map, a network of places joined by
   * routes, a track, a ring or grid of action spaces, regions, tiles laid edge to edge, or no board
   * (cards, a market and player boards). Older saved games have none.
   */
  board?: string;
  components: string;
  rules: string[];
  winCondition: string;
  /** Mechanic vocabulary; doubles as the retrieval query. */
  mechanics: string[];
  /** Integer knobs that become params and UI sliders. */
  tunables: { key: string; label: string; min: number; max: number; default: number }[];
}

export interface PlayStats {
  numPlayers: number;
  games: number;
  medianTurns: number;
  drawRate: number;
  winRateBySeat: number[];
  truncatedRate: number;
  /** Distinct move kinds seen (the "type" field of object moves, or the value's type). */
  moveKinds: string[];
  /** Share of turns where the mover had more than one legal move. */
  choiceRate: number;
  /**
   * Share of games a player who plans ahead (short playouts) wins against random opponents, over
   * every seat. Measured for competitive games without bluffing, where it shows whether skill pays.
   */
  plannerWinRate?: number;
  /** Games behind plannerWinRate: fewer than asked for when a slow game ran out of time. */
  plannerGames?: number;
}

export interface RulesCheck {
  ok: boolean;
  loadError?: string;
  failures: FuzzFailure[];
  /** Set when a single game stopped making progress (an infinite loop) and the worker was killed. */
  stalled?: { seed: number; numPlayers: number; params: Params; afterMs: number };
  /** Set when the whole check ran out of time or memory. */
  aborted?: string;
  /** Random-play statistics, once the rules pass fuzzing. */
  play?: PlayStats;
  /** Design problems the playtest found in rules that work; see playIssues. */
  issues?: string[];
}

/** A library entry the rules build on, as the stream reports it. */
export interface MechanicSummary {
  id: string;
  title: string;
  description: string;
}

/** Steps of the design as they happen, with what each made. */
export type DesignEvent =
  /** The plan, once written. */
  | { type: "spec"; spec: GameSpec }
  /** The library entries the rules build on. */
  | { type: "mechanics"; mechanics: MechanicSummary[] }
  /** Rules are being written: from scratch (attempt 0), or again to fix what the last check found. */
  | { type: "writing"; attempt: number }
  /** A piece of the rules as Muse Spark writes them. */
  | { type: "code"; text: string }
  /** Complete rules, about to be checked. */
  | { type: "draft"; attempt: number; source: string }
  /** How far the check has got: fuzzing runs and playtest games started, of about how many. */
  | { type: "checking"; attempt: number; done: number; total: number }
  /** The check's verdict: rules that break, or that work but play badly (issues), go back for a fix. */
  | { type: "checked"; attempt: number; ok: boolean; problem?: string; issues?: string[]; play?: PlayStats };

/** The verdict on one round of rules, as the stream reports it ("checked" without its type). */
export type CheckSummary = Omit<Extract<DesignEvent, { type: "checked" }>, "type">;

export interface DesignResult {
  ok: boolean;
  spec: GameSpec;
  /** Catalog ids handed to the compose step, most useful first. */
  retrieved: string[];
  source: string;
  /** One entry per fuzz pass: attempt 0 is the first draft, then one per repair. */
  attempts: RulesCheck[];
}

/** The stream's "result" for a new game: the design, and the id it was saved under. */
export type GenerateReply = DesignResult & { id?: string };

export interface RevisionResult {
  ok: boolean;
  /** The game as it was. */
  game: Pick<GameMeta, "name" | "summary" | "family" | "mode" | "minPlayers" | "maxPlayers">;
  source: string;
  attempts: RulesCheck[];
  /** Playtest of the game as it was and as revised, for a before-and-after comparison. */
  before?: PlayStats;
  after?: PlayStats;
  rulesBefore: string[];
  rulesAfter: string[];
}

/** The stream's "result" for a revision: the new version's id and title when it was saved. */
export type ReviseReply = RevisionResult & { id?: string; title?: string };
