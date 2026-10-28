import * as engine from "@boarddream/engine";
import type { GameModule } from "@boarddream/engine";
import * as mechanics from "@boarddream/library/mechanics";

const MODULES: Record<string, unknown> = {
  "@boarddream/engine": engine,
  "@boarddream/mechanics": mechanics,
};

const sources = new WeakMap<GameModule, string>();

/** The rules source a generated game was loaded from, so a worker can load it too. */
export const generatedSource = (game: GameModule) => sources.get(game);

interface SavedGame {
  id: string;
  rules?: string[];
}

/**
 * Games generated earlier: those bundled with the web app (public/demo-games, so a static deploy
 * has some) and those the server saved, when one is running. A game that no longer loads, e.g.
 * after an engine change, is left out.
 */
export async function savedGames(): Promise<GameModule[]> {
  const fetchList = async (url: string): Promise<SavedGame[]> => {
    try {
      const res = await fetch(url);
      return res.ok ? ((await res.json()) as SavedGame[]) : [];
    } catch {
      return [];
    }
  };
  const bundled = `${import.meta.env.BASE_URL}demo-games/`;
  const sources = [
    ...(await fetchList(`${bundled}index.json`)).map((game) => ({ ...game, url: `${bundled}${game.id}.js` })),
    ...(await fetchList("/api/games")).map((game) => ({ ...game, url: `/api/games/${game.id}` })),
  ];
  const games: GameModule[] = [];
  for (const { id, rules, url } of sources) {
    if (games.some((g) => g.meta.id === id)) continue;
    try {
      const res = await fetch(url);
      if (res.ok) games.push(loadGeneratedGame(await res.text(), id, rules));
    } catch {
      // Skip it; the others still load.
    }
  }
  return games;
}

/**
 * Runs generated rules that already passed server-side fuzzing and playtesting. `id` replaces the
 * game's own id (the saved game's id), so two generated games never collide.
 */
export function loadGeneratedGame(source: string, id?: string, rules?: string[]): GameModule {
  const module = { exports: {} as Record<string, unknown> };
  const require = (id: string) => {
    if (id in MODULES) return MODULES[id];
    throw new Error(`require("${id}") is not allowed`);
  };
  new Function("module", "exports", "require", `"use strict";\n${source}`)(module, module.exports, require);
  const exported = module.exports as { default?: unknown; game?: unknown };
  const game = (exported.default ?? exported.game ?? exported) as GameModule;
  // The designer's rules fill in when the module does not state its own.
  const named = { ...game, meta: { ...game.meta, id: id ?? game.meta.id, rules: game.meta.rules ?? rules } };
  sources.set(named, source);
  return named;
}
