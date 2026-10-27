import { fuzz, type FuzzFailure, type GameModule } from "@boarddream/engine";
import type { Bm25Index, Hit } from "@boarddream/retrieval";
import type { ModelClient } from "../meta/client";
import { loadGameFromSource } from "../sandbox";
import { composeMessages, extractCode, formatFailures, repairMessages, specMessages } from "./prompts";
import { engineInterfaceSource, loadReference, type Reference } from "./references";
import { gameSpecSchema, type GameRequest, type GameSpec } from "./spec";

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
  retrieved: Hit[];
  source: string;
  /** One entry per fuzz pass: attempt 0 is the first draft, then one per repair. */
  attempts: RulesCheck[];
}

/** Prompt + dials -> spec -> retrieved mechanics -> rules code -> fuzz/repair loop. */
export async function designGame(request: GameRequest, deps: DesignDeps): Promise<DesignResult> {
  const { llm, index, maxRepairs = 4, fuzzRuns = 1000, onProgress = () => {} } = deps;

  onProgress("drafting spec");
  const spec = await llm.chatJson<GameSpec>(specMessages(request), gameSpecSchema);

  // BM25 baseline. TODO(day 2-3): LLM query expansion + rerank, compared with `npm run eval:retrieval`.
  const retrieved = index.search([spec.pitch, spec.winCondition, ...spec.mechanics].join(" "), 6);
  const references = retrieved.map((hit) => loadReference(hit.id)).filter((r): r is Reference => r !== undefined);

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
