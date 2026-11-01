import type { PlayMode } from "@boarddream/engine";
import { catalog } from "@boarddream/library";
import type { Dials, Interaction, Theme } from "./spec";

/** How many mechanics a player can ask a game to be built around. */
export const MUST_USE_LIMIT = 3;

const MODES: PlayMode[] = ["competitive", "cooperative", "hidden-role"];
const FAMILIES: NonNullable<Dials["family"]>[] = ["engine", "map", "grid", "bluff"];
const INTERACTIONS: Interaction[] = ["gentle", "some", "cutthroat"];
const THEMES: Theme[] = ["nature", "history", "fantasy", "scifi"];

const mechanics = new Map(catalog.filter((e) => e.kind === "mechanic" && e.status === "ready").map((e) => [e.id, e.title]));

/** The titles of library mechanics, from their catalog ids. */
export const mechanicTitles = (ids: string[] = []) => ids.flatMap((id) => mechanics.get(id) ?? []);

const choice = <T extends string>(value: unknown, allowed: T[]): T | undefined => allowed.find((a) => a === value);
const number = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/**
 * The dials as a page sent them, made safe to hand to the designer: numbers in range, only known
 * choices, and only mechanics the library has, at most MUST_USE_LIMIT of them.
 */
export function cleanDials(input: unknown): Dials {
  const d = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const minPlayers = Math.round(number(d.minPlayers, 1, 6, 2));
  const dials: Dials = {
    minPlayers,
    maxPlayers: Math.round(number(d.maxPlayers, minPlayers, 6, Math.max(minPlayers, 4))),
    playMinutes: Math.round(number(d.playMinutes, 10, 180, 60)),
    complexity: Math.round(number(d.complexity, 1, 5, 3)),
    luck: number(d.luck, 0, 1, 0.3),
    mode: choice(d.mode, MODES) ?? "competitive",
  };
  const family = choice(d.family, FAMILIES);
  if (family) dials.family = family;
  const interaction = choice(d.interaction, INTERACTIONS);
  if (interaction) dials.interaction = interaction;
  const theme = choice(d.theme, THEMES);
  if (theme) dials.theme = theme;
  const mustUse = Array.isArray(d.mustUse) ? [...new Set(d.mustUse.filter((id): id is string => typeof id === "string" && mechanics.has(id)))] : [];
  if (mustUse.length) dials.mustUse = mustUse.slice(0, MUST_USE_LIMIT);
  return dials;
}

/** The dials as the models read them: the mechanics a player asked for by title rather than id. */
export const dialsForModel = (dials: Dials) => (dials.mustUse ? { ...dials, mustUse: mechanicTitles(dials.mustUse) } : dials);
