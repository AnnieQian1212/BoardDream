import type { PlayMode } from "@boarddream/engine";
import type { Dials } from "./generation";

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
];

export const INTERACTIONS: { value: NonNullable<Dials["interaction"]>; label: string; hint: string }[] = [
  { value: "gentle", label: "Gentle", hint: "Players mostly build their own and race; no attacks or stealing" },
  { value: "some", label: "Some", hint: "Players compete for shared spaces, market cards and majorities" },
  { value: "cutthroat", label: "Cutthroat", hint: "Blocking, stealing and fights over majorities every round" },
];

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
