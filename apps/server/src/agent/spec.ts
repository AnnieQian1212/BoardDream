import type { GameFamily, PlayMode } from "@boarddream/engine";
import type { JsonSchema } from "../meta/client";

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

export interface GameRequest {
  prompt: string;
  dials: Dials;
}

/** The designer's plan for a game, written before any rules code. */
export interface GameSpec {
  title: string;
  pitch: string;
  family: GameFamily;
  mode: PlayMode;
  minPlayers: number;
  maxPlayers: number;
  components: string;
  rules: string[];
  winCondition: string;
  /** Mechanic vocabulary; doubles as the retrieval query. */
  mechanics: string[];
  /** Integer knobs that become params and UI sliders. */
  tunables: { key: string; label: string; min: number; max: number; default: number }[];
}

const str = { type: "string" };
const int = { type: "integer" };

export const gameSpecSchema: JsonSchema = {
  name: "GameSpec",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "pitch",
      "family",
      "mode",
      "minPlayers",
      "maxPlayers",
      "components",
      "rules",
      "winCondition",
      "mechanics",
      "tunables",
    ],
    properties: {
      title: str,
      pitch: str,
      // No "race": roll-and-move games are not what BoardDream designs.
      family: { type: "string", enum: ["engine", "map", "grid", "bluff"] },
      mode: { type: "string", enum: ["competitive", "cooperative", "hidden-role"] },
      minPlayers: int,
      maxPlayers: int,
      components: str,
      rules: { type: "array", items: str },
      winCondition: str,
      mechanics: { type: "array", items: str },
      tunables: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "label", "min", "max", "default"],
          properties: { key: str, label: str, min: int, max: int, default: int },
        },
      },
    },
  },
};
