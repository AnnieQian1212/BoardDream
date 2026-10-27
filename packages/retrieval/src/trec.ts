import type { Hit } from "./bm25";

/** Parses TREC qrels lines: `qid iteration docid grade`. */
export function parseQrels(text: string): Map<string, Map<string, number>> {
  const qrels = new Map<string, Map<string, number>>();
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const [qid, , docId, gradeText] = parts;
    const judgments = qrels.get(qid) ?? new Map<string, number>();
    judgments.set(docId, Number(gradeText));
    qrels.set(qid, judgments);
  }
  return qrels;
}

/** Formats a TREC run file (`qid Q0 docid rank score tag`), readable by trec_eval and ir_measures. */
export function formatRun(run: ReadonlyMap<string, readonly Hit[]>, tag: string): string {
  const lines: string[] = [];
  for (const [qid, hits] of run) {
    hits.forEach((hit, i) => lines.push(`${qid} Q0 ${hit.id} ${i + 1} ${hit.score.toFixed(6)} ${tag}`));
  }
  return lines.join("\n") + "\n";
}
