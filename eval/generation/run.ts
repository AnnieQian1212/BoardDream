// Fuzz-repair benchmark: runs the full designer pipeline (spec -> retrieve -> compose -> isolated
// fuzz -> repair) on every prompt in prompts.jsonl and reports how often rules pass, and after how
// many repairs. Model replies are cached in eval/generation/cache/, so reruns are free.
//
//   npm run eval:generation                 # every prompt
//   npm run eval:generation -- g01,g09      # a subset
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { catalog, catalogText } from "@boarddream/library";
import { Bm25Index } from "@boarddream/retrieval";
import { designGame, type DesignResult } from "../../apps/server/src/agent/designer";
import type { GameRequest } from "../../apps/server/src/agent/spec";
import { config } from "../../apps/server/src/config";
import { CachedModelClient } from "../../apps/server/src/meta/cache";

const MAX_REPAIRS = 4;
const FUZZ_RUNS = 1000;
const CONCURRENCY = 3;
// Muse Spark 1.3 list prices per token (reasoning tokens are billed as completion tokens).
const PRICE = { prompt: 1.25e-6, completion: 4.25e-6 };

const here = new URL("./", import.meta.url);
const prompts = readFileSync(new URL("prompts.jsonl", here), "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as GameRequest & { id: string });
const only = process.argv[2]?.split(",");
const selected = only ? prompts.filter((p) => only.includes(p.id)) : prompts;

const index = new Bm25Index(catalog.filter((e) => e.status === "ready").map((e) => ({ id: e.id, text: catalogText(e) })));
const llm = new CachedModelClient({ ...config.meta, model: config.models.designer }, new URL("cache/", here));
const outDir = new URL("out/", here);
mkdirSync(outDir, { recursive: true });

interface Row {
  id: string;
  family: string;
  ok: boolean;
  /** Repairs needed before the rules passed; undefined when they never did. */
  repairs?: number;
  error?: string;
  failureKinds: string[];
  retrieved: string[];
}

function kinds(result: DesignResult): string[] {
  return result.attempts.map((a) =>
    a.loadError ? "load-error" : a.stalled ? "hang" : a.aborted ? "aborted" : a.ok ? "pass" : [...new Set(a.failures.map((f) => f.kind))].join("+"),
  );
}

async function runOne(request: GameRequest & { id: string }): Promise<Row> {
  const log = (event: string) => console.log(`[${request.id}] ${event}`);
  try {
    const result = await designGame(request, { llm, index, maxRepairs: MAX_REPAIRS, fuzzRuns: FUZZ_RUNS, onProgress: log });
    writeFileSync(new URL(`${request.id}.js`, outDir), result.source + "\n");
    writeFileSync(new URL(`${request.id}.json`, outDir), JSON.stringify({ ...result, source: undefined }, null, 2) + "\n");
    const passed = result.attempts.findIndex((a) => a.ok);
    log(result.ok ? `passed after ${passed} repairs` : `failed after ${MAX_REPAIRS} repairs`);
    return {
      id: request.id,
      family: result.spec.family,
      ok: result.ok,
      repairs: passed >= 0 ? passed : undefined,
      failureKinds: kinds(result),
      retrieved: result.retrieved,
    };
  } catch (err) {
    log(`error: ${String(err)}`);
    return { id: request.id, family: "?", ok: false, error: String(err), failureKinds: [], retrieved: [] };
  }
}

async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const rows = await mapPool(selected, CONCURRENCY, runOne);
writeFileSync(new URL("results.json", outDir), JSON.stringify(rows, null, 2) + "\n");

const n = rows.length;
const passedBy = (k: number) => rows.filter((r) => r.repairs !== undefined && r.repairs <= k).length;
console.log(`\n${n} prompts`);
for (let k = 0; k <= MAX_REPAIRS; k++) console.log(`  passing after ${k} repair${k === 1 ? "" : "s"}: ${passedBy(k)}/${n}`);
const repaired = rows.filter((r) => r.repairs !== undefined);
if (repaired.length) console.log(`  mean repairs among passing: ${(repaired.reduce((s, r) => s + r.repairs!, 0) / repaired.length).toFixed(2)}`);
const tally = new Map<string, number>();
for (const r of rows) for (const k of r.failureKinds.filter((k) => k !== "pass")) tally.set(k, (tally.get(k) ?? 0) + 1);
console.log(`  failure kinds over all attempts: ${[...tally].map(([k, c]) => `${k} ${c}`).join(", ") || "none"}`);
for (const r of rows) console.log(`  ${r.id} ${r.family.padEnd(6)} ${r.ok ? "pass" : "FAIL"} ${r.failureKinds.join(" > ")}${r.error ? ` (${r.error})` : ""}`);
const cost = llm.usage.promptTokens * PRICE.prompt + llm.usage.completionTokens * PRICE.completion;
console.log(`\nMuse Spark: ${llm.usage.calls} new calls (${llm.usage.promptTokens} prompt + ${llm.usage.completionTokens} completion tokens, ~$${cost.toFixed(2)}), ${llm.hits} cached`);
