import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { DesignResult } from "./agent/designer";

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
}

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "game";

export function saveGame(result: DesignResult): SavedGame {
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
  };
  writeFileSync(new URL(`${id}.js`, DIR), result.source + "\n");
  writeFileSync(new URL(`${id}.json`, DIR), JSON.stringify({ ...saved, spec: result.spec, attempts: result.attempts }, null, 2) + "\n");
  return saved;
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

export function gameSource(id: string): string | undefined {
  if (!/^[a-z0-9-]+$/.test(id)) return undefined;
  const file = new URL(`${id}.js`, DIR);
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}
