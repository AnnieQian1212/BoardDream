import { fuzz, type FuzzFailure, type GameModule } from "@boarddream/engine";
import type { Bm25Index } from "@boarddream/retrieval";
import type { ModelClient } from "../meta/client";
import { loadGameFromSource } from "../sandbox";
import { composeMessages, extractCode, formatFailures, repairMessages, specMessages } from "./prompts";
import { engineInterfaceSource, loadReference, type Reference } from "./references";
import { expandedSearch, rerank } from "./retrieve";
import { gameSpecSchema, type GameRequest, type GameSpec } from "./spec";

/** Candidates the reranker sees, and how many of its top picks go into the compose prompt. */
const RERANK_POOL = 20;
const REFERENCES = 6;

export interface DesignDeps {
  llm: ModelClient;
  index: Bm25Index;
  maxRepairs?: number;
  fuzzRuns?: number;
  onProgress?: (event: string) => void;
}

export interface RulesCheck {
  ok: boolean;
  loadError?: string;
  failures: FuzzFailure[];
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
  const { llm, index, maxRepairs = 4, fuzzRuns = 1000, onProgress = () => {} } = deps;

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
  let source = extractCode(await llm.chat(composeMessages(spec, engineInterfaceSource(), references)));

  const attempts: RulesCheck[] = [];
  for (let attempt = 0; ; attempt++) {
    onProgress(`fuzzing attempt ${attempt}`);
    const check = checkRules(source, fuzzRuns);
    attempts.push(check);
    if (check.ok || attempt >= maxRepairs) return { ok: check.ok, spec, retrieved, source, attempts };
    onProgress(`repairing ${check.loadError ? "load error" : `${check.failures.length} failures`}`);
    source = extractCode(await llm.chat(repairMessages(spec, source, formatFailures(check.loadError, check.failures))));
  }
}

/** Loads generated rules and fuzzes them. TODO(day 3): run in a worker thread so infinite loops can be killed. */
export function checkRules(source: string, runs: number): RulesCheck {
  let game: GameModule;
  try {
    game = loadGameFromSource(source);
  } catch (err) {
    return { ok: false, loadError: err instanceof Error ? err.message : String(err), failures: [] };
  }
  const report = fuzz(game, { runs });
  return { ok: report.ok, failures: report.failures };
}
