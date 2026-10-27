import type { CatalogEntry } from "@boarddream/library";
import type { Bm25Index } from "@boarddream/retrieval";
import type { ModelClient } from "../meta/client";

/**
 * Muse Spark on both sides of BM25: before it, rewrite a free-form game idea into mechanic vocabulary
 * (query expansion); after it, reorder the candidates by how directly the game needs them (rerank).
 * eval/retrieval measures each step against plain BM25.
 */

const stringList = (name: string, key: string, items: Record<string, unknown> = { type: "string" }) => ({
  name,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [key],
    properties: { [key]: { type: "array", items } },
  },
});

export async function expandQuery(llm: ModelClient, idea: string): Promise<string[]> {
  const reply = await llm.chatJson<{ mechanics: string[] }>(
    [
      {
        role: "system",
        content: `You name board game mechanics. Given a game idea, list 3 to 8 standard mechanic names and close
synonyms a designer would search a mechanic library for, such as "roll and move", "set collection", "hidden roles",
"k in a row", "flanking capture", "push your luck". Short phrases only; no explanations.`,
      },
      { role: "user", content: idea },
    ],
    stringList("Mechanics", "mechanics"),
  );
  return reply.mechanics;
}

/** BM25 over the idea plus its expansion. */
export async function expandedSearch(llm: ModelClient, index: Bm25Index, idea: string, k: number) {
  const mechanics = await expandQuery(llm, idea);
  return index.search(`${idea} ${mechanics.join(" ")}`, k);
}

/**
 * Candidate ids ordered by usefulness for the idea. Candidates the model leaves out keep their
 * original order after the ones it ranked, so this only ever reorders the candidate list.
 */
export async function rerank(llm: ModelClient, idea: string, candidates: readonly CatalogEntry[]): Promise<string[]> {
  const ids = candidates.map((c) => c.id);
  const list = candidates.map((c) => `- ${c.id}: ${c.title}. ${c.description}`).join("\n");
  const reply = await llm.chatJson<{ ranking: string[] }>(
    [
      {
        role: "system",
        content: `You choose building blocks for a board game rules engine. Rank the candidate mechanics and reference
games by how directly the described game needs them: first what it cannot be built without, then a close reference
game, then generally useful helpers. Leave out candidates that do not fit the game at all.`,
      },
      { role: "user", content: `Game idea: ${idea}\n\nCandidates:\n${list}` },
    ],
    stringList("Ranking", "ranking", { type: "string", enum: ids }),
  );
  const ranked = [...new Set(reply.ranking.filter((id) => ids.includes(id)))];
  return [...ranked, ...ids.filter((id) => !ranked.includes(id))];
}
