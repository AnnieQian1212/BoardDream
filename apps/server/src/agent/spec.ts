import type { JsonSchema } from "../meta/client";
import type { Dials, GameSpec, RecentGame } from "./protocol";

// The plain types live in protocol.ts, which the web app reads too.
export type { BoardShape, Dials, GameSpec, Goal, Interaction, Powers, RecentGame, Theme, Tone } from "./protocol";

export interface GameRequest {
  prompt: string;
  dials: Dials;
  /**
   * Games made here lately, newest first, so a new one can differ from them in kind, board and name
   * when the idea leaves those open.
   */
  recent?: RecentGame[];
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
      "board",
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
      board: str,
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
