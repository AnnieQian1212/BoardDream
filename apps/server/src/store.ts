import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { DesignResult, RevisionResult } from "./agent/designer";
import type { RecentGame } from "./agent/spec";

/**
 * Generated games that passed playtesting, saved as data/games/<id>.js (the rules) and <id>.json
 * (spec, retrieval and playtest record) so they survive restarts and show up in the game picker.
 */

const DIR = new URL("../../../data/games/", import.meta.url);

export interface SavedGame {
  id: string;
  title: string;
  pitch: string;
  family: string;
  createdAt: string;
  retrieved: string[];
  /** Playtest rounds before the rules passed (1 = the first draft). */
  rounds: number;
  /** The designer's rules, for players and AI opponents. */
  rules: string[];
  /** The idea the game was made from, and whether Muse Spark invented it ("Surprise me"). */
  idea?: string;
  invented?: boolean;
}

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "game";

export function saveGame(result: DesignResult, origin?: { idea: string; invented: boolean }): SavedGame {
  mkdirSync(DIR, { recursive: true });
  const id = `${slug(result.spec.title)}-${Date.now().toString(36)}`;
  const saved: SavedGame = {
    id,
    title: result.spec.title,
    pitch: result.spec.pitch,
    family: result.spec.family,
    createdAt: new Date().toISOString(),
    retrieved: result.retrieved,
    rounds: result.attempts.length,
    rules: result.spec.rules,
    ...origin,
  };
  writeFileSync(new URL(`${id}.js`, DIR), result.source + "\n");
  writeFileSync(new URL(`${id}.json`, DIR), JSON.stringify({ ...saved, spec: result.spec, attempts: result.attempts }, null, 2) + "\n");
  return saved;
}

/** The table shape of a game saved before specs named one, from the mechanics it was built on. */
const BOARDS: [string, string][] = [
  ["mech:hex-map", "a hex map of terrain"],
  ["mech:tile-placement", "tiles laid edge to edge"],
  ["mech:square-grid", "a square grid"],
  ["mech:worker-placement", "a board of action spaces"],
  ["mech:area-control", "regions of a map"],
  ["mech:connection", "places joined by routes"],
];

/**
 * The games saved lately, newest first: name, family and board, for the designer to differ from.
 * Revisions are left out; they repeat the game they revise.
 */
export function recentDesigns(count = 8): RecentGame[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(new URL(name, DIR), "utf8")) as SavedGame & { spec?: { board?: string; mechanics?: string[] }; revisedFrom?: string | null })
    .filter((game) => !("revisedFrom" in game))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, count)
    .map((game) => ({
      title: game.title,
      family: game.family,
      board: game.spec?.board || BOARDS.find(([id]) => game.retrieved?.includes(id))?.[1] || "cards and player boards, no shared board",
      mechanics: game.spec?.mechanics,
    }));
}

/** Saved games, newest first. */
export function listGames(): SavedGame[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const { spec, attempts: _attempts, ...saved } = JSON.parse(readFileSync(new URL(name, DIR), "utf8")) as SavedGame & {
        spec?: { rules?: string[] };
        attempts: unknown;
      };
      // Games saved before rules were recorded still have them in their spec.
      return { ...saved, rules: saved.rules ?? spec?.rules ?? [] };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** "Grove (revised)" for a first revision of "Grove", then "Grove (revised 2)", and so on. */
export function revisedTitle(title: string): string {
  const match = title.match(/^(.*) \(revised(?: (\d+))?\)$/);
  if (!match) return `${title} (revised)`;
  return `${match[1]} (revised ${Number(match[2] ?? 1) + 1})`;
}

/** A designer's revision, saved as a game of its own next to the one it changed. */
export function saveRevision(baseId: string | undefined, result: RevisionResult, request: string): SavedGame {
  const base = baseId && /^[a-z0-9-]+$/.test(baseId) && existsSync(new URL(`${baseId}.json`, DIR))
    ? (JSON.parse(readFileSync(new URL(`${baseId}.json`, DIR), "utf8")) as SavedGame & { spec?: DesignResult["spec"] })
    : undefined;
  const title = revisedTitle(base?.title ?? result.game.name);
  // A game the server never saved (a bundled demo game) gets its spec from the game's own meta.
  const { name, summary, family, mode, minPlayers, maxPlayers } = result.game;
  const fallback: DesignResult["spec"] = { title: name, pitch: summary, family, mode, minPlayers, maxPlayers, components: "", rules: [], winCondition: "", mechanics: [], tunables: [] };
  const spec = { ...(base?.spec ?? fallback), title, rules: result.rulesAfter };
  // The revision was made from the same idea as the game it changed.
  const origin = base?.idea ? { idea: base.idea, invented: Boolean(base.invented) } : undefined;
  const saved = saveGame({ ok: true, spec, retrieved: base?.retrieved ?? [], source: result.source, attempts: result.attempts }, origin);
  const file = new URL(`${saved.id}.json`, DIR);
  writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), revisedFrom: baseId ?? null, request }, null, 2) + "\n");
  return saved;
}

export function gameSource(id: string): string | undefined {
  if (!/^[a-z0-9-]+$/.test(id)) return undefined;
  const file = new URL(`${id}.js`, DIR);
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

/**
 * Takes a saved game out of the picker. Its files move to data/games/deleted/, where the list does
 * not look, so a game deleted by mistake can be put back by hand. False when there is no such game.
 */
export function deleteGame(id: string): boolean {
  if (!/^[a-z0-9-]+$/.test(id) || !existsSync(new URL(`${id}.json`, DIR))) return false;
  const bin = new URL("deleted/", DIR);
  mkdirSync(bin, { recursive: true });
  for (const ext of ["js", "json"]) {
    const file = new URL(`${id}.${ext}`, DIR);
    if (existsSync(file)) renameSync(file, new URL(`${id}.${ext}`, bin));
  }
  return true;
}
