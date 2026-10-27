import * as engine from "@boarddream/engine";
import type { GameModule } from "@boarddream/engine";
import * as mechanics from "@boarddream/library/mechanics";

const MODULES: Record<string, unknown> = {
  "@boarddream/engine": engine,
  "@boarddream/mechanics": mechanics,
};

/**
 * Runs generated rules that already passed server-side fuzzing.
 * TODO(day 4): load inside a Web Worker or sandboxed iframe instead of the page itself.
 */
export function loadGeneratedGame(source: string): GameModule {
  const module = { exports: {} as Record<string, unknown> };
  const require = (id: string) => {
    if (id in MODULES) return MODULES[id];
    throw new Error(`require("${id}") is not allowed`);
  };
  new Function("module", "exports", "require", `"use strict";\n${source}`)(module, module.exports, require);
  const exported = module.exports as { default?: unknown; game?: unknown };
  return (exported.default ?? exported.game ?? exported) as GameModule;
}
