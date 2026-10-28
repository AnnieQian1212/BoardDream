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
