import type { GameMeta } from "@boarddream/engine";
import type { Bm25Index } from "@boarddream/retrieval";
import type { ChatMessage, ModelClient } from "../meta/client";
import { checkRulesIsolated, type RulesCheck } from "./check";
import { mechanicTitles } from "./dials";
import { loadGameFromSource } from "../sandbox";
import type { PlayStats } from "./playtest";
import { composeMessages, designRepairMessages, extractCode, formatFailures, repairMessages, revisionMessages, specMessages, type DesignBrief } from "./prompts";
import { engineInterfaceSource, loadReference, type Reference } from "./references";
import { expandedSearch, rerank } from "./retrieve";
import { gameSpecSchema, type GameRequest, type GameSpec } from "./spec";

/** Candidates the reranker sees, and how many of its top picks go into the compose prompt. */
const RERANK_POOL = 20;
const REFERENCES = 6;
/** What each family is about, for the search when the player chose one. */
const FAMILY_WORDS: Record<NonNullable<GameRequest["dials"]["family"]>, string> = {
  engine: "engine building with a tableau of cards that pay income",
  map: "building on a hex map that produces resources, with trading",
  grid: "tile placement and area control on a board",
  bluff: "bluffing, bidding and hidden information",
};
/** Repair rounds spent on design problems in rules that already work. */
const MAX_DESIGN_FIXES = 1;

export interface DesignDeps {
  llm: ModelClient;
  index: Bm25Index;
  maxRepairs?: number;
  fuzzRuns?: number;
  /** One line per step, for logs. */
  onProgress?: (event: string) => void;
  /** What the designer has made so far, for a live view of the game taking shape. */
  onEvent?: (event: DesignEvent) => void;
  /** Stops the work between steps and midway through writing, e.g. when the player has left. */
  signal?: AbortSignal;
}

/** Steps of the design as they happen, with what each made. */
export type DesignEvent =
  /** The plan, once written. */
  | { type: "spec"; spec: GameSpec }
  /** The library entries the rules build on. */
  | { type: "mechanics"; mechanics: { id: string; title: string; description: string }[] }
  /** Rules are being written: from scratch (attempt 0), or again to fix what the last check found. */
  | { type: "writing"; attempt: number }
  /** A piece of the rules as Muse Spark writes them. */
  | { type: "code"; text: string }
  /** Complete rules, about to be checked. */
  | { type: "draft"; attempt: number; source: string }
  /** How far the check has got: fuzzing runs and playtest games started, of about how many. */
  | { type: "checking"; attempt: number; done: number; total: number }
  /** The check's verdict: rules that break, or that work but play badly (issues), go back for a fix. */
  | { type: "checked"; attempt: number; ok: boolean; problem?: string; issues?: string[]; play?: PlayStats };

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
  const { llm, index, onProgress = () => {}, onEvent = () => {}, signal } = deps;

  const { dials } = request;
  // The search looks for the idea, plus the mechanics and the family the player chose, if any.
  const query = [request.prompt, ...mechanicTitles(dials.mustUse), dials.family && FAMILY_WORDS[dials.family]].filter(Boolean).join(". ");

  // The spec and the search both start from the request alone, so they run side by side.
  onProgress("drafting spec");
  onProgress("retrieving mechanics");
  const [spec, references] = await Promise.all([
    llm.chatJson<GameSpec>(specMessages(request), gameSpecSchema).then((drafted) => {
      const spec = dials.family ? { ...drafted, family: dials.family } : drafted;
      onEvent({ type: "spec", spec });
      return spec;
    }),
    // The pipeline eval/retrieval measures: Muse Spark query expansion, BM25, then Muse Spark rerank.
    // The mechanics the player asked for come first, whatever the search ranks.
    (async () => {
      const pool = (await expandedSearch(llm, index, query, RERANK_POOL))
        .map((hit) => loadReference(hit.id))
        .filter((r): r is Reference => r !== undefined);
      const order = await rerank(llm, query, pool.map((r) => r.entry));
      const asked = (dials.mustUse ?? []).map(loadReference).filter((r): r is Reference => r !== undefined);
      const ranked = order.filter((id) => !asked.some((r) => r.entry.id === id)).map((id) => pool.find((r) => r.entry.id === id)!);
      return [...asked, ...ranked].slice(0, REFERENCES);
    })(),
  ]);
  const retrieved = references.map((r) => r.entry.id);
  onEvent({ type: "mechanics", mechanics: references.map(({ entry }) => ({ id: entry.id, title: entry.title, description: entry.description })) });
  signal?.throwIfAborted();

  onProgress("writing rules");
  onEvent({ type: "writing", attempt: 0 });
  const source = extractCode(await write(composeMessages(spec, engineInterfaceSource(), references), deps));
  return { spec, retrieved, ...(await settle(spec, source, deps)) };
}

/** Streams a reply that holds rules, passing each piece on as it is written. */
const write = (messages: ChatMessage[], { llm, onEvent, signal }: DesignDeps) =>
  llm.chatStream(messages, (text) => onEvent?.({ type: "code", text }), {}, signal);

/**
 * Fuzzes rules and sends failures back for repair until they pass or the repairs run out; rules
 * that pass get one round to fix the design problems the playtest found.
 */
async function settle(brief: DesignBrief, draft: string, deps: DesignDeps): Promise<{ ok: boolean; source: string; attempts: RulesCheck[] }> {
  const { maxRepairs = 4, fuzzRuns = 1000, onProgress = () => {}, onEvent = () => {}, signal } = deps;
  let source = draft;
  const attempts: RulesCheck[] = [];
  // The newest rules that pass fuzzing, in case a design fix breaks them and repairs run out.
  let passing: string | undefined;
  let designFixes = 0;
  for (let attempt = 0; ; attempt++) {
    onProgress(`fuzzing attempt ${attempt}`);
    onEvent({ type: "draft", attempt, source });
    const check = await checkRulesIsolated(source, { runs: fuzzRuns, signal, onProgress: (done, total) => onEvent({ type: "checking", attempt, done, total }) });
    signal?.throwIfAborted();
    attempts.push(check);
    onEvent({ type: "checked", attempt, ok: check.ok, problem: check.ok ? undefined : problem(check), issues: check.issues, play: check.play });
    if (check.ok) passing = source;
    // Working rules get one round to fix design problems the playtest found.
    const fixDesign = check.ok && (check.issues?.length ?? 0) > 0 && designFixes < MAX_DESIGN_FIXES;
    if ((check.ok && !fixDesign) || attempt >= maxRepairs) {
      return { ok: passing !== undefined, source: passing ?? source, attempts };
    }
    onEvent({ type: "writing", attempt: attempt + 1 });
    if (fixDesign) {
      designFixes++;
      onProgress(`improving the design: ${check.issues!.join("; ")}`);
      source = extractCode(await write(designRepairMessages(brief, source, check.issues!), deps));
    } else {
      onProgress(`repairing: ${summarize(check)}`);
      source = extractCode(await write(repairMessages(brief, source, formatFailures(check)), deps));
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
  const { onProgress = () => {}, onEvent = () => {} } = deps;
  const game = loadGameFromSource(source);
  const brief = { title: game.meta.name, pitch: game.meta.summary, designerRequest: request };
  onProgress("rewriting the rules");
  onEvent({ type: "writing", attempt: 0 });
  const [before, draft] = await Promise.all([
    checkRulesIsolated(source, { runs: 50, signal: deps.signal }),
    write(revisionMessages(source, request), deps).then(extractCode),
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

/** What went wrong in a check, in a line a player can read. */
function problem(check: RulesCheck): string {
  if (check.loadError) return `the rules did not load: ${check.loadError}`;
  if (check.stalled) return "a game never ended";
  if (check.aborted) return check.aborted;
  const [first] = check.failures;
  return `${check.failures.length === 1 ? "one kind of fault" : `${check.failures.length} kinds of fault`}, such as: ${first?.message ?? "unknown"}`;
}

function summarize(check: RulesCheck): string {
  if (check.loadError) return "load error";
  if (check.stalled) return "a game hung";
  if (check.aborted) return check.aborted;
  return `${check.failures.length} failure kinds`;
}
