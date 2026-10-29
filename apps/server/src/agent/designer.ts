import type { GameMeta } from "@boarddream/engine";
import type { Bm25Index } from "@boarddream/retrieval";
import type { ModelClient } from "../meta/client";
import { checkRulesIsolated, type RulesCheck } from "./check";
import { loadGameFromSource } from "../sandbox";
import type { PlayStats } from "./playtest";
import { composeMessages, designRepairMessages, extractCode, formatFailures, repairMessages, revisionMessages, specMessages, type DesignBrief } from "./prompts";
import { engineInterfaceSource, loadReference, type Reference } from "./references";
import { expandedSearch, rerank } from "./retrieve";
import { gameSpecSchema, type GameRequest, type GameSpec } from "./spec";

/** Candidates the reranker sees, and how many of its top picks go into the compose prompt. */
const RERANK_POOL = 20;
const REFERENCES = 6;
/** Repair rounds spent on design problems in rules that already work. */
const MAX_DESIGN_FIXES = 1;

export interface DesignDeps {
  llm: ModelClient;
  index: Bm25Index;
  maxRepairs?: number;
  fuzzRuns?: number;
  onProgress?: (event: string) => void;
}

export interface DesignResult {
  ok: boolean;
  spec: GameSpec;
  /** Catalog ids handed to the compose step, most useful first. */
  retrieved: string[];
  source: string;
  /** One entry per fuzz pass: attempt 0 is the first draft, then one per repair. */
  attempts: RulesCheck[];
}

/** Prompt + dials -> spec -> retrieved mechanics -> rules code -> fuzz/repair loop. */
export async function designGame(request: GameRequest, deps: DesignDeps): Promise<DesignResult> {
  const { llm, index, onProgress = () => {} } = deps;

  onProgress("drafting spec");
  const spec = await llm.chatJson<GameSpec>(specMessages(request), gameSpecSchema);

  // The pipeline eval/retrieval measures: Muse Spark query expansion, BM25, then Muse Spark rerank.
  onProgress("retrieving mechanics");
  const pool = (await expandedSearch(llm, index, request.prompt, RERANK_POOL))
    .map((hit) => loadReference(hit.id))
    .filter((r): r is Reference => r !== undefined);
  const order = await rerank(llm, request.prompt, pool.map((r) => r.entry));
  const retrieved = order.slice(0, REFERENCES);
  const references = retrieved.map((id) => pool.find((r) => r.entry.id === id)!);

  onProgress("writing rules");
  const source = extractCode(await llm.chat(composeMessages(spec, engineInterfaceSource(), references)));
  return { spec, retrieved, ...(await settle(spec, source, deps)) };
}

/**
 * Fuzzes rules and sends failures back for repair until they pass or the repairs run out; rules
 * that pass get one round to fix the design problems the playtest found.
 */
async function settle(brief: DesignBrief, draft: string, deps: DesignDeps): Promise<{ ok: boolean; source: string; attempts: RulesCheck[] }> {
  const { llm, maxRepairs = 4, fuzzRuns = 1000, onProgress = () => {} } = deps;
  let source = draft;
  const attempts: RulesCheck[] = [];
  // The newest rules that pass fuzzing, in case a design fix breaks them and repairs run out.
  let passing: string | undefined;
  let designFixes = 0;
  for (let attempt = 0; ; attempt++) {
    onProgress(`fuzzing attempt ${attempt}`);
    const check = await checkRulesIsolated(source, { runs: fuzzRuns });
    attempts.push(check);
    if (check.ok) passing = source;
    // Working rules get one round to fix design problems the playtest found.
    const fixDesign = check.ok && (check.issues?.length ?? 0) > 0 && designFixes < MAX_DESIGN_FIXES;
    if ((check.ok && !fixDesign) || attempt >= maxRepairs) {
      return { ok: passing !== undefined, source: passing ?? source, attempts };
    }
    if (fixDesign) {
      designFixes++;
      onProgress(`improving the design: ${check.issues!.join("; ")}`);
      source = extractCode(await llm.chat(designRepairMessages(brief, source, check.issues!)));
    } else {
      onProgress(`repairing: ${summarize(check)}`);
      source = extractCode(await llm.chat(repairMessages(brief, source, formatFailures(check))));
    }
  }
}

export interface RevisionResult {
  ok: boolean;
  /** The game as it was. */
  game: Pick<GameMeta, "name" | "summary" | "family" | "mode" | "minPlayers" | "maxPlayers">;
  source: string;
  attempts: RulesCheck[];
  /** Playtest of the game as it was and as revised, for a before-and-after comparison. */
  before?: PlayStats;
  after?: PlayStats;
  rulesBefore: string[];
  rulesAfter: string[];
}

/**
 * A designer's change to working rules, in their words: Muse Spark rewrites the module, then the
 * new rules go through the same fuzz, repair and playtest loop as a new game. The original is
 * playtested meanwhile, so the designer sees what the change did.
 */
export async function reviseGame(source: string, request: string, deps: DesignDeps): Promise<RevisionResult> {
  const { llm, onProgress = () => {} } = deps;
  const game = loadGameFromSource(source);
  const brief = { title: game.meta.name, pitch: game.meta.summary, designerRequest: request };
  onProgress("rewriting the rules");
  const [before, draft] = await Promise.all([
    checkRulesIsolated(source, { runs: 50 }),
    llm.chat(revisionMessages(source, request)).then(extractCode),
  ]);
  const settled = await settle(brief, draft, deps);
  const revised = settled.ok ? loadGameFromSource(settled.source) : undefined;
  return {
    ...settled,
    game: {
      name: game.meta.name,
      summary: game.meta.summary,
      family: game.meta.family,
      mode: game.meta.mode,
      minPlayers: game.meta.minPlayers,
      maxPlayers: game.meta.maxPlayers,
    },
    before: before.play,
    after: settled.attempts.filter((a) => a.ok).at(-1)?.play,
    rulesBefore: game.meta.rules ?? [],
    rulesAfter: revised?.meta.rules ?? [],
  };
}

function summarize(check: RulesCheck): string {
  if (check.loadError) return "load error";
  if (check.stalled) return "a game hung";
  if (check.aborted) return check.aborted;
  return `${check.failures.length} failure kinds`;
}
