// Scores retrieval over the mechanic catalog and writes a TREC run file.
// Cross-check with standard tooling, e.g.:
//   ir_measures eval/retrieval/qrels.txt eval/retrieval/out/bm25.run nDCG@10 R@10 RR AP
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { catalog, catalogText } from "@boarddream/library";
import { Bm25Index, evaluateRun, formatRun, parseQrels, type Hit } from "@boarddream/retrieval";

const here = new URL("./", import.meta.url);
const queries = readFileSync(new URL("queries.jsonl", here), "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as { qid: string; text: string });
const qrels = parseQrels(readFileSync(new URL("qrels.txt", here), "utf8"));

// Systems to compare. TODO(day 2-3): + LLM query expansion, + Muse Spark rerank.
const systems: Record<string, (query: string) => Hit[]> = {
  bm25: (() => {
    const index = new Bm25Index(catalog.map((e) => ({ id: e.id, text: catalogText(e) })));
    return (query: string) => index.search(query, 10);
  })(),
};

mkdirSync(new URL("out/", here), { recursive: true });
for (const [name, search] of Object.entries(systems)) {
  const run = new Map(queries.map((q) => [q.qid, search(q.text)]));
  writeFileSync(new URL(`out/${name}.run`, here), formatRun(run, name));
  const { mean } = evaluateRun(new Map([...run].map(([qid, hits]) => [qid, hits.map((h) => h.id)])), qrels, 10);
  console.log(name.padEnd(12), Object.entries(mean).map(([m, v]) => `${m} ${v.toFixed(3)}`).join("  "));
}
