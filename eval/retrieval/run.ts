// Scores retrieval over the mechanic catalog for each system and writes TREC run files.
// Cross-check with standard tooling, e.g.:
//   ir_measures eval/retrieval/qrels.txt eval/retrieval/out/bm25.run nDCG@10 R@10 RR AP
// Muse Spark replies are cached in eval/retrieval/cache/, so reruns cost nothing.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { catalog, catalogText } from "@boarddream/library";
import { Bm25Index, evaluateRun, formatRun, ndcgAt, parseQrels, type Hit } from "@boarddream/retrieval";
import { expandedSearch, rerank } from "../../apps/server/src/agent/retrieve";
import { config } from "../../apps/server/src/config";
import { CachedModelClient } from "../../apps/server/src/meta/cache";

const DEPTH = 10;
const RERANK_POOL = 20;
const CONCURRENCY = 6;
// Muse Spark 1.3 list prices per token (reasoning tokens are billed as completion tokens).
const PRICE = { prompt: 1.25e-6, completion: 4.25e-6 };

const here = new URL("./", import.meta.url);
const queries = readFileSync(new URL("queries.jsonl", here), "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as { qid: string; text: string });
const qrels = parseQrels(readFileSync(new URL("qrels.txt", here), "utf8"));

const index = new Bm25Index(catalog.map((e) => ({ id: e.id, text: catalogText(e) })));
const byId = new Map(catalog.map((e) => [e.id, e]));
const llm = new CachedModelClient({ ...config.meta, model: config.models.designer }, new URL("cache/", here));

const systems: Record<string, (query: string) => Promise<Hit[]>> = {
  bm25: async (query) => index.search(query, DEPTH),
  "bm25+expand": (query) => expandedSearch(llm, index, query, DEPTH),
  "bm25+expand+rerank": async (query) => {
    const pool = await expandedSearch(llm, index, query, RERANK_POOL);
    const order = await rerank(llm, query, pool.map((hit) => byId.get(hit.id)!));
    return order.slice(0, DEPTH).map((id, i) => ({ id, score: DEPTH - i }));
  },
};

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts || String(err).includes("MODEL_API_KEY")) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000 * i));
    }
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

mkdirSync(new URL("out/", here), { recursive: true });
const rankings = new Map<string, Map<string, string[]>>();
let skipped = false;
for (const [name, search] of Object.entries(systems)) {
  let results: Hit[][];
  try {
    results = await mapPool(queries, CONCURRENCY, (q) => withRetry(() => search(q.text)));
  } catch (err) {
    console.log(`${name.padEnd(20)} skipped: ${err instanceof Error ? err.message.slice(0, 120) : err}`);
    skipped = true;
    continue;
  }
  const run = new Map(queries.map((q, i) => [q.qid, results[i]]));
  writeFileSync(new URL(`out/${name}.run`, here), formatRun(run, name));
  const ranked = new Map([...run].map(([qid, hits]) => [qid, hits.map((h) => h.id)]));
  rankings.set(name, ranked);
  const { mean } = evaluateRun(ranked, qrels, DEPTH);
  console.log(name.padEnd(20), Object.entries(mean).map(([m, v]) => `${m} ${v.toFixed(3)}`).join("  "));
}

// Per-query comparison against the BM25 baseline.
const baseline = rankings.get("bm25")!;
for (const [name, ranked] of rankings) {
  if (name === "bm25") continue;
  let wins = 0;
  let losses = 0;
  for (const [qid, rel] of qrels) {
    const delta = ndcgAt(ranked.get(qid) ?? [], rel, DEPTH) - ndcgAt(baseline.get(qid) ?? [], rel, DEPTH);
    if (delta > 1e-9) wins++;
    else if (delta < -1e-9) losses++;
  }
  console.log(`${name} vs bm25 on nDCG@${DEPTH}: ${wins} better, ${qrels.size - wins - losses} same, ${losses} worse`);
}

const cost = llm.usage.promptTokens * PRICE.prompt + llm.usage.completionTokens * PRICE.completion;
// Keep the committed cache to exactly the replies behind these numbers.
const pruned = skipped ? 0 : llm.prune();
console.log(
  `\nMuse Spark: ${llm.usage.calls} new calls (${llm.usage.promptTokens} prompt + ${llm.usage.completionTokens} completion tokens, ~$${cost.toFixed(3)}), ${llm.hits} cached, ${pruned} stale cache files removed`,
);
