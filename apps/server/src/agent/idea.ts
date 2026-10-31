import type { PlayMode } from "@boarddream/engine";
import type { ChatMessage, JsonSchema, ModelClient } from "../meta/client";
import type { Dials } from "./spec";

/**
 * "Surprise me": Muse Spark invents the idea a player would otherwise type. Asked plainly it keeps
 * coming back to a few favorite themes, so each idea gets a setting and the mechanic it is built
 * around drawn at random, and the games already made are named so it does not repeat them.
 */

/** Original settings, one drawn per idea. */
export const SETTINGS = [
  "lighthouse keepers on a storm-battered coast",
  "night-market cooks competing for the best stalls",
  "glassblowers in a lagoon city",
  "cartographers charting a fog-bound archipelago",
  "tea caravans crossing high mountain passes",
  "keepers of a clockwork menagerie",
  "salt traders on shimmering desert flats",
  "divers restoring a dying coral reef",
  "botanists tending an orbital greenhouse",
  "lantern makers preparing a river festival",
  "barge traders on a slow, winding river",
  "mushroom foragers in an ancient forest",
  "perfumers in a spice port",
  "railway surveyors on a frontier plateau",
  "bell founders in a cathedral town",
  "kite makers on windswept cliffs",
  "deep-sea salvage crews",
  "silk weavers' guilds along a trade road",
  "astronomers cataloguing comets from rival observatories",
  "ice cutters harvesting a frozen lake",
  "a touring puppet theatre troupe",
  "researchers at a remote glacier station",
  "ferry captains on a sprawling delta",
  "herders of sky whales above the clouds",
  "builders of hot-spring resorts in a misty valley",
  "truffle hunters and their dogs",
  "dye works along a river of many colors",
  "shipwrights in a busy harbor",
  "falconers at a mountain court",
  "tram line builders in a city of hills",
  "miners on a newly settled moon",
  "orchard keepers through four seasons",
  "rival circus acts on a winter tour",
  "rangers protecting a wildlife reserve",
  "chocolatiers sourcing cacao from distant islands",
  "monks copying star charts in a desert library",
  "smugglers in a city of canals and fog",
  "terraformers greening a red planet",
  "pearl divers of a sunken kingdom",
  "airship couriers between floating towns",
];

/** What the game is built around, by mode; each one has tested modules in the library. */
export const SPINES: Record<PlayMode, string[]> = {
  competitive: [
    "a card market and an engine of cards that pay income",
    "worker placement on shared action spaces",
    "area majorities across regions of a map",
    "building on a hex map that produces resources, with trading",
    "placing tiles whose edges must match, scoring regions",
    "card drafting",
    "set collection",
    "deck building",
    "bidding for turn order and first pick",
  ],
  cooperative: [
    "worker placement while a shared threat rises each round",
    "deck building against a shared threat",
    "a hex map the players defend together",
    "placing tiles to hold back a spreading threat",
  ],
  "hidden-role": [
    "hidden roles and votes at the table",
    "bluffing with face-down claims that others may challenge",
    "secret bids, with a hidden traitor among the players",
  ],
};

const ideaSchema: JsonSchema = {
  name: "GameIdea",
  schema: { type: "object", additionalProperties: false, required: ["idea"], properties: { idea: { type: "string" } } },
};

export function ideaMessages(dials: Dials, avoid: string[], random: () => number = Math.random): ChatMessage[] {
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
  return [
    {
      role: "system",
      content: `You think up ideas for board games that BoardDream will then design, build and playtest.
Write the idea the way a player would type it to a friend: one or two sentences, at most 35 words, saying
who the players are, what they do and what they compete for (in a co-op game, what they hold off together;
with hidden roles, who is secretly working against whom).
- The players are experienced hobby gamers, teens and adults: promise a strategy game with real choices,
  never a children's game or roll-and-move.
- Set it in the given setting and build it around the given mechanic. Fit the dials: player count, play
  time, complexity (1 gateway to 5 heavy), luck (0 pure strategy to 1 mostly luck) and mode.
- Original: never a published game, nor one with its names changed. Nothing like the games in "avoid".
- No title, no rule lists, no component counts.`,
    },
    { role: "user", content: JSON.stringify({ setting: pick(SETTINGS), builtAround: pick(SPINES[dials.mode] ?? SPINES.competitive), dials, avoid }) },
  ];
}

/** A fresh idea for a game that fits the dials, unlike the games in `avoid`. */
export async function inventIdea(llm: ModelClient, dials: Dials, avoid: string[], random: () => number = Math.random): Promise<string> {
  const { idea } = await llm.chatJson<{ idea: string }>(ideaMessages(dials, avoid, random), ideaSchema);
  return idea.trim();
}
