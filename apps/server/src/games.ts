import { existsSync, readFileSync } from "node:fs";
import type { GameModule } from "@boarddream/engine";
import { referenceGames } from "@boarddream/library";
import { loadGameFromSource } from "./sandbox";
import { gameSource, listGames } from "./store";

/**
 * Every game a shared table can play, by the id the web app knows it by: the library's games, the
 * games saved here, and the generated games bundled with the web app. A generated game carries the
 * id and title it was saved under, as the web app shows it, whatever its own module says.
 */

const BUNDLED = new URL("../../web/public/demo-games/", import.meta.url);
const loaded = new Map<string, GameModule>();

interface Listed {
  id: string;
  title: string;
  rules?: string[];
}

function bundled(id: string): { source: string; entry?: Listed } | undefined {
  if (!/^[a-z0-9-]+$/.test(id)) return undefined;
  const file = new URL(`${id}.js`, BUNDLED);
  if (!existsSync(file)) return undefined;
  const index = new URL("index.json", BUNDLED);
  const entries = existsSync(index) ? (JSON.parse(readFileSync(index, "utf8")) as Listed[]) : [];
  return { source: readFileSync(file, "utf8"), entry: entries.find((e) => e.id === id) };
}

export function gameById(id: string): GameModule | undefined {
  const library = referenceGames.find((g) => g.meta.id === id);
  if (library) return library;
  const cached = loaded.get(id);
  if (cached) return cached;
  const saved = gameSource(id);
  const found = saved !== undefined ? { source: saved, entry: listGames().find((g) => g.id === id) as Listed | undefined } : bundled(id);
  if (!found) return undefined;
  try {
    const game = loadGameFromSource(found.source);
    const named: GameModule = {
      ...game,
      meta: { ...game.meta, id, name: found.entry?.title ?? game.meta.name, rules: game.meta.rules ?? found.entry?.rules },
    };
    loaded.set(id, named);
    return named;
  } catch {
    return undefined;
  }
}
