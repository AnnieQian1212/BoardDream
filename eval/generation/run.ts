// Fuzz-repair benchmark: runs the full designer pipeline (spec -> retrieve -> compose -> isolated
// fuzz -> repair -> playtest) on every prompt in prompts.jsonl and reports how often rules pass,
// after how many repairs, and whether planning ahead beats random play in the games that pass.
// Model replies are cached in eval/generation/cache/, so reruns are free.
//
//   npm run eval:generation                 # every prompt
//   npm run eval:generation -- g01,g09      # a subset
//   npm run eval:generation -- --setup=low  # another model setting (see SETUPS), into out/low/
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { catalog, catalogText } from "@boarddream/library";
import { Bm25Index } from "@boarddream/retrieval";
import { designGame, type DesignResult } from "../../apps/server/src/agent/designer";
import { skillEdge } from "../../apps/server/src/agent/playtest";
import type { GameRequest } from "../../apps/server/src/agent/spec";
import { config } from "../../apps/server/src/config";
import { CachedModelClient } from "../../apps/server/src/meta/cache";
import type { ClientOptions } from "../../apps/server/src/meta/client";

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
const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith("--"))?.split(",");
const selected = only ? prompts.filter((p) => only.includes(p.id)) : prompts;

/**
 * Model settings to compare. "spark" is Muse Spark 1.3 at its default reasoning effort, the
 * setting the results below were first measured with; the others trade thinking for speed.
 */
const SETUPS: Record<string, ClientOptions> = {
  spark: { ...config.meta, model: config.models.designer },
  low: { ...config.meta, model: config.models.designer, defaults: { reasoningEffort: "low" } },
  medium: { ...config.meta, model: config.models.designer, defaults: { reasoningEffort: "medium" } },
  // Muse Spark Open on Baseten; rules need far more tokens than the opponents' default cap.
  open: { ...config.openModel, defaults: { reasoningEffort: "low", maxTokens: 32_000 } },
};
const setup = args.find((a) => a.startsWith("--setup="))?.slice("--setup=".length) ?? "spark";
if (!SETUPS[setup]) throw new Error(`unknown setup ${setup}; one of ${Object.keys(SETUPS).join(", ")}`);

const index = new Bm25Index(catalog.filter((e) => e.status === "ready").map((e) => ({ id: e.id, text: catalogText(e) })));
const llm = new CachedModelClient(SETUPS[setup], new URL("cache/", here));
const outDir = new URL(setup === "spark" ? "out/" : `out/${setup}/`, here);
mkdirSync(outDir, { recursive: true });

interface Row {
  id: string;
  family: string;
  mode: string;
  title?: string;
  ok: boolean;
  /** Repairs needed before the rules passed; undefined when they never did. */
  repairs?: number;
  error?: string;
  failureKinds: string[];
  retrieved: string[];
  /** Playtest of the final rules: seats, the planner's win rate against random play and its skill edge. */
  numPlayers?: number;
  plannerWinRate?: number;
  skillEdge?: number;
  /** Design problems the playtest found in the first working rules, and those still in the final ones. */
  designIssues: string[];
  issuesLeft: string[];
  /** Wall-clock seconds from the idea to the final rules (meaningless when every reply was cached). */
  seconds: number;
}

function kinds(result: DesignResult): string[] {
  return result.attempts.map((a) =>
    a.loadError ? "load-error" : a.stalled ? "hang" : a.aborted ? "aborted" : a.ok ? "pass" : [...new Set(a.failures.map((f) => f.kind))].join("+"),
  );
}

async function runOne(request: GameRequest & { id: string }): Promise<Row> {
  const started = Date.now();
  const seconds = () => Math.round((Date.now() - started) / 1000);
  const log = (event: string) => console.log(`[${request.id} +${seconds()}s] ${event}`);
  try {
    const result = await designGame(request, { llm, index, maxRepairs: MAX_REPAIRS, fuzzRuns: FUZZ_RUNS, onProgress: log });
    writeFileSync(new URL(`${request.id}.js`, outDir), result.source + "\n");
    writeFileSync(new URL(`${request.id}.json`, outDir), JSON.stringify({ ...result, source: undefined }, null, 2) + "\n");
    const passed = result.attempts.findIndex((a) => a.ok);
    log(result.ok ? `passed after ${passed} repairs` : `failed after ${MAX_REPAIRS} repairs`);
    const working = result.attempts.filter((a) => a.ok);
    const play = working.at(-1)?.play;
    return {
      id: request.id,
      family: result.spec.family,
      mode: result.spec.mode,
      title: result.spec.title,
      ok: result.ok,
      repairs: passed >= 0 ? passed : undefined,
      failureKinds: kinds(result),
      retrieved: result.retrieved,
      numPlayers: play?.numPlayers,
      plannerWinRate: play?.plannerWinRate,
      skillEdge: play && skillEdge(play),
      designIssues: working[0]?.issues ?? [],
      issuesLeft: working.at(-1)?.issues ?? [],
      seconds: seconds(),
    };
  } catch (err) {
    log(`error: ${String(err)}`);
    return { id: request.id, family: "?", mode: "?", ok: false, error: String(err), failureKinds: [], retrieved: [], designIssues: [], issuesLeft: [], seconds: seconds() };
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
const pct = (x: number) => `${Math.round(x * 100)}%`;
const times = rows.map((r) => r.seconds).sort((a, b) => a - b);
console.log(`\nSetup ${setup}: median ${times[Math.floor(n / 2)]} s from idea to final rules (fastest ${times[0]} s, slowest ${times[n - 1]} s)`);
const passedBy = (k: number) => rows.filter((r) => r.repairs !== undefined && r.repairs <= k).length;
console.log(`\n${n} prompts`);
for (let k = 0; k <= MAX_REPAIRS; k++) console.log(`  passing after ${k} repair${k === 1 ? "" : "s"}: ${passedBy(k)}/${n}`);
const repaired = rows.filter((r) => r.repairs !== undefined);
if (repaired.length) console.log(`  mean repairs among passing: ${(repaired.reduce((s, r) => s + r.repairs!, 0) / repaired.length).toFixed(2)}`);
const tally = new Map<string, number>();
for (const r of rows) for (const k of r.failureKinds.filter((k) => k !== "pass")) tally.set(k, (tally.get(k) ?? 0) + 1);
console.log(`  failure kinds over all attempts: ${[...tally].map(([k, c]) => `${k} ${c}`).join(", ") || "none"}`);
const measured = rows.filter((r) => r.skillEdge !== undefined);
if (measured.length) {
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const deep = measured.filter((r) => r.skillEdge! >= 0.25).length;
  console.log(
    `  strategic depth over ${measured.length} measurable games: planner wins ${pct(mean(measured.map((r) => r.plannerWinRate!)))} (fair share ${pct(mean(measured.map((r) => 1 / r.numPlayers!)))}), mean skill edge ${mean(measured.map((r) => r.skillEdge!)).toFixed(2)}, ${deep} with an edge of 0.25 or more`,
  );
}
const flagged = rows.filter((r) => r.designIssues.length > 0);
console.log(`  design problems found by the playtest: ${flagged.length} games, ${flagged.filter((r) => r.issuesLeft.length === 0).length} fixed`);
for (const r of rows) {
  const depth = r.skillEdge === undefined ? "" : ` planner ${pct(r.plannerWinRate!)} of ${r.numPlayers}p (edge ${r.skillEdge.toFixed(2)})`;
  console.log(`  ${r.id} ${r.family.padEnd(6)} ${r.ok ? "pass" : "FAIL"} ${r.failureKinds.join(" > ")}${depth}${r.error ? ` (${r.error})` : ""}`);
  for (const issue of r.designIssues) console.log(`      ${r.issuesLeft.includes(issue) ? "left" : "fixed"}: ${issue}`);
  for (const issue of r.issuesLeft.filter((i) => !r.designIssues.includes(i))) console.log(`      new: ${issue}`);
}
const cost = llm.usage.promptTokens * PRICE.prompt + llm.usage.completionTokens * PRICE.completion;
console.log(`\n${llm.model}: ${llm.usage.calls} new calls (${llm.usage.promptTokens} prompt + ${llm.usage.completionTokens} completion tokens, ~$${cost.toFixed(2)}), ${llm.hits} cached`);
