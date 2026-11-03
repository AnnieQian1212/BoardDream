import type { PlayMode } from "@boarddream/engine";
import type { Dials, Effort } from "./generation";

/** The choices on the create panel beyond players, time, complexity, luck and mode. */

export const FAMILIES: { value: NonNullable<Dials["family"]>; label: string }[] = [
  { value: "engine", label: "Engine building" },
  { value: "map", label: "Map and trade" },
  { value: "grid", label: "Tiles and areas" },
  { value: "bluff", label: "Bluffing" },
];

export const THEMES: { value: NonNullable<Dials["theme"]>; label: string }[] = [
  { value: "nature", label: "Nature" },
  { value: "history", label: "History" },
  { value: "fantasy", label: "Fantasy" },
  { value: "scifi", label: "Sci-fi" },
  { value: "myth", label: "Myth and folklore" },
  { value: "mystery", label: "Mystery" },
  { value: "everyday", label: "Everyday life" },
];

export const BOARDS: { value: NonNullable<Dials["board"]>; label: string }[] = [
  { value: "hex", label: "Hex map" },
  { value: "network", label: "Places and routes" },
  { value: "track", label: "A winding track" },
  { value: "spaces", label: "Action spaces" },
  { value: "regions", label: "Regions" },
  { value: "tiles", label: "Tiles laid edge to edge" },
  { value: "none", label: "No board: cards only" },
];

export const GOALS: { value: NonNullable<Dials["goal"]>; label: string }[] = [
  { value: "points", label: "Most points" },
  { value: "race", label: "First to a goal" },
  { value: "secret", label: "Secret objectives" },
];

export const POWERS: { value: Dials["powers"]; label: string; hint: string }[] = [
  { value: undefined, label: "Any", hint: "Left to the designer" },
  { value: "same", label: "Same", hint: "Every player starts alike" },
  { value: "unique", label: "Unique", hint: "Each player gets a role with a power of their own" },
];

export const TONES: { value: NonNullable<Dials["tone"]>; label: string }[] = [
  { value: "cozy", label: "Cozy" },
  { value: "whimsical", label: "Whimsical" },
  { value: "tense", label: "Tense" },
  { value: "epic", label: "Epic" },
  { value: "mysterious", label: "Mysterious" },
];

export const INTERACTIONS: { value: NonNullable<Dials["interaction"]>; label: string; hint: string }[] = [
  { value: "gentle", label: "Gentle", hint: "Players mostly build their own and race; no attacks or stealing" },
  { value: "some", label: "Some", hint: "Players compete for shared spaces, market cards and majorities" },
  { value: "cutthroat", label: "Cutthroat", hint: "Blocking, stealing and fights over majorities every round" },
];

/**
 * How hard Muse Spark thinks while it designs the game, and about how long a game takes at each
 * effort, from idea to a table you can play, repairs included (measured: eval/generation/README.md).
 */
export const EFFORTS: { value: Effort; label: string; wait: string; note: string }[] = [
  { value: "low", label: "Low", wait: "2–4 minutes", note: "Fastest, but more first drafts fail their tests and need a repair." },
  { value: "medium", label: "Medium", wait: "3–7 minutes", note: "Recommended: every idea in our tests passed within one repair." },
  { value: "high", label: "High", wait: "5–9 minutes", note: "Slowest; thinks longest over the rules, and its first drafts pass most often." },
];
export const DEFAULT_EFFORT: Effort = "medium";

/** How many mechanics a player can ask for (MUST_USE_LIMIT in apps/server/src/agent/dials.ts). */
export const MUST_USE_LIMIT = 3;

const ALL: PlayMode[] = ["competitive", "cooperative", "hidden-role"];
const OPEN: PlayMode[] = ["competitive", "cooperative"];
const DECEIT: PlayMode[] = ["competitive", "hidden-role"];

/** Library mechanics a game can be built around (catalog ids), and the modes they suit. */
export const MECHANICS: { id: string; label: string; modes: PlayMode[] }[] = [
  { id: "mech:area-control", label: "Area control", modes: ["competitive"] },
  { id: "mech:bidding", label: "Bids and challenges", modes: DECEIT },
  { id: "mech:face-down-claims", label: "Bluffed claims", modes: DECEIT },
  { id: "mech:card-drafting", label: "Card drafting", modes: DECEIT },
  { id: "mech:effects", label: "Card engine", modes: OPEN },
  { id: "mech:market", label: "Card market", modes: OPEN },
  { id: "mech:deck-building", label: "Deck building", modes: OPEN },
  { id: "mech:dice", label: "Dice", modes: ALL },
  { id: "mech:hex-map", label: "Hex map building", modes: OPEN },
  { id: "mech:hidden-information", label: "Hidden information", modes: ALL },
  { id: "mech:hidden-roles", label: "Hidden roles", modes: ["hidden-role"] },
  { id: "mech:production", label: "Resource production", modes: OPEN },
  { id: "mech:cooperative-threat", label: "Rising threat", modes: ["cooperative"] },
  { id: "mech:set-collection", label: "Set collection", modes: OPEN },
  { id: "mech:tile-placement", label: "Tile placement", modes: OPEN },
  { id: "mech:trading", label: "Trading", modes: OPEN },
  { id: "mech:voting", label: "Voting", modes: ["hidden-role"] },
  { id: "mech:worker-placement", label: "Worker placement", modes: OPEN },
];

export const mechanicLabel = (id: string) => MECHANICS.find((m) => m.id === id)?.label ?? id;
