import type { PlayMode } from "@boarddream/engine";
import type { ChatMessage, JsonSchema, ModelClient } from "../meta/client";
import { dialsForModel, mechanicTitles } from "./dials";
import type { Dials, Theme } from "./spec";

/**
 * "Surprise me": Muse Spark invents the idea a player would otherwise type. Asked plainly it keeps
 * coming back to a few favorite themes, so each idea gets a setting and the mechanic it is built
 * around drawn at random, and the games already made are named so it does not repeat them. The
 * player's theme, game type and mechanics narrow the draw.
 */

/** Original settings by theme, one drawn per idea. */
export const SETTINGS: Record<Theme, string[]> = {
  nature: [
    "lighthouse keepers on a storm-battered coast",
    "divers restoring a dying coral reef",
    "mushroom foragers in an ancient forest",
    "researchers at a remote glacier station",
    "builders of hot-spring resorts in a misty valley",
    "truffle hunters and their dogs",
    "orchard keepers through four seasons",
    "rangers protecting a wildlife reserve",
    "ice cutters harvesting a frozen lake",
    "kite makers on windswept cliffs",
    "naturalists counting birds along a migration flyway",
  ],
  history: [
    "night-market cooks competing for the best stalls",
    "glassblowers in a lagoon city",
    "cartographers charting a fog-bound archipelago",
    "tea caravans crossing high mountain passes",
    "salt traders on shimmering desert flats",
    "lantern makers preparing a river festival",
    "barge traders on a slow, winding river",
    "perfumers in a spice port",
    "railway surveyors on a frontier plateau",
    "bell founders in a cathedral town",
    "deep-sea salvage crews",
    "silk weavers' guilds along a trade road",
    "astronomers cataloguing comets from rival observatories",
    "a touring puppet theatre troupe",
    "ferry captains on a sprawling delta",
    "dye works along a river of many colors",
    "shipwrights in a busy harbor",
    "falconers at a mountain court",
    "tram line builders in a city of hills",
    "rival circus acts on a winter tour",
    "chocolatiers sourcing cacao from distant islands",
    "monks copying star charts in a desert library",
    "smugglers in a city of canals and fog",
  ],
  fantasy: [
    "keepers of a clockwork menagerie",
    "herders of sky whales above the clouds",
    "pearl divers of a sunken kingdom",
    "airship couriers between floating towns",
    "alchemists trading reagents at a floating market",
    "wardens of dragon eggs in a volcanic aerie",
    "golem builders in a mountain forge city",
    "druids tending a forest of walking trees",
    "mapmakers of a dream realm that shifts each night",
    "witches brewing moonlit remedies for a sleepy village",
    "librarians whose books open into the worlds they describe",
  ],
  scifi: [
    "botanists tending an orbital greenhouse",
    "miners on a newly settled moon",
    "terraformers greening a red planet",
    "salvage crews stripping derelicts in an asteroid belt",
    "engineers keeping a generation ship running",
    "xenobiologists cataloguing life in an ocean under ice",
    "robot gardeners reclaiming an abandoned city",
    "couriers racing cargo around a ring station",
    "archaeologists decoding ruins on a desert moon",
    "cooks running a diner at a busy spaceport",
  ],
};

/** Every setting, for a player who chose no theme. */
export const ALL_SETTINGS = Object.values(SETTINGS).flat();

/** What a game is built around, by mode, with its game type; each one has tested modules in the library. */
export const SPINES: Record<PlayMode, { spine: string; family: NonNullable<Dials["family"]> }[]> = {
  competitive: [
    { spine: "a card market and an engine of cards that pay income", family: "engine" },
    { spine: "worker placement on shared action spaces", family: "engine" },
    { spine: "card drafting", family: "engine" },
    { spine: "set collection", family: "engine" },
    { spine: "deck building", family: "engine" },
    { spine: "building on a hex map that produces resources, with trading", family: "map" },
    { spine: "claiming routes and ports across a hex map, with trading", family: "map" },
    { spine: "area majorities across regions of a map", family: "grid" },
    { spine: "placing tiles whose edges must match, scoring regions", family: "grid" },
    { spine: "bidding for turn order and first pick", family: "bluff" },
    { spine: "bluffing with face-down claims that others may challenge", family: "bluff" },
  ],
  cooperative: [
    { spine: "worker placement while a shared threat rises each round", family: "engine" },
    { spine: "deck building against a shared threat", family: "engine" },
    { spine: "a hex map the players defend together", family: "map" },
    { spine: "placing tiles to hold back a spreading threat", family: "grid" },
  ],
  "hidden-role": [
    { spine: "hidden roles and votes at the table", family: "bluff" },
    { spine: "bluffing with face-down claims that others may challenge", family: "bluff" },
    { spine: "secret bids, with a hidden traitor among the players", family: "bluff" },
  ],
};

const ideaSchema: JsonSchema = {
  name: "GameIdea",
  schema: { type: "object", additionalProperties: false, required: ["idea"], properties: { idea: { type: "string" } } },
};

/**
 * The setting is drawn from the player's theme, or from all of them. The game is built around the
 * mechanics the player asked for, or else around a spine drawn for the mode, of their game type
 * when the mode has one.
 */
export function ideaMessages(dials: Dials, avoid: string[], random: () => number = Math.random): ChatMessage[] {
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
  const spines = SPINES[dials.mode] ?? SPINES.competitive;
  const typed = spines.filter((s) => s.family === dials.family);
  const builtAround = dials.mustUse?.length ? mechanicTitles(dials.mustUse).join(" and ") : pick(typed.length ? typed : spines).spine;
  const setting = pick(dials.theme ? SETTINGS[dials.theme] : ALL_SETTINGS);
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
  time, complexity (1 gateway to 5 heavy), luck (0 pure strategy to 1 mostly luck), mode and, when set,
  interaction ("gentle": players mostly build their own and race; "cutthroat": they clash directly).
- Original: never a published game, nor one with its names changed. Nothing like the games in "avoid".
- No title, no rule lists, no component counts.`,
    },
    { role: "user", content: JSON.stringify({ setting, builtAround, dials: dialsForModel(dials), avoid }) },
  ];
}

/** A fresh idea for a game that fits the dials, unlike the games in `avoid`. */
export async function inventIdea(llm: ModelClient, dials: Dials, avoid: string[], random: () => number = Math.random): Promise<string> {
  const { idea } = await llm.chatJson<{ idea: string }>(ideaMessages(dials, avoid, random), ideaSchema);
  return idea.trim();
}
