import vm from "node:vm";
import * as engine from "@boarddream/engine";
import type { GameModule } from "@boarddream/engine";
import * as mechanics from "@boarddream/library/mechanics";

/** Modules generated rules may require. Anything else fails at load time. */
const ALLOWED_MODULES: Record<string, unknown> = {
  "@boarddream/engine": engine,
  "@boarddream/mechanics": mechanics,
};

const REQUIRED_METHODS = ["setup", "activePlayers", "legalMoves", "applyMove", "isTerminal", "outcome"] as const;

/**
 * Loads generated rules (a CommonJS-style JS module) into a fresh vm context.
 *
 * Not a security boundary: vm stops accidents (no fs, no Math.random, load-time timeout), not
 * attackers, and the timeout covers only top-level code. Before exposing generation publicly, run
 * load + fuzz in a worker thread with a hard kill, or in a remote sandbox.
 */
export function loadGameFromSource(source: string, timeoutMs = 1000): GameModule {
  const module = { exports: {} as Record<string, unknown> };
  const require = (id: string) => {
    if (id in ALLOWED_MODULES) return ALLOWED_MODULES[id];
    throw new Error(`require("${id}") is not allowed; use only ${Object.keys(ALLOWED_MODULES).join(", ")}`);
  };
  const context = vm.createContext({ module, exports: module.exports, require, console: { log() {}, warn() {}, error() {} } });
  vm.runInContext(
    "Math.random = () => { throw new Error('Math.random is not allowed; use the rng argument'); };",
    context,
  );
  vm.runInContext(`"use strict";\n${source}`, context, { filename: "generated-rules.js", timeout: timeoutMs });

  const exported = module.exports as { default?: unknown; game?: unknown };
  const game = (exported.default ?? exported.game ?? exported) as GameModule;
  const missing = REQUIRED_METHODS.filter((m) => typeof game[m] !== "function");
  if (!game.meta || !Array.isArray(game.params) || missing.length > 0) {
    throw new Error(
      `module must export a GameModule with meta, params and ${REQUIRED_METHODS.join(", ")}` +
        (missing.length ? `; missing: ${missing.join(", ")}` : ""),
    );
  }
  return game;
}
