/** Graded judgments for one query: doc id -> grade, where 0 means non-relevant. */
export type Judgments = ReadonlyMap<string, number>;

const grade = (rel: Judgments, id: string) => rel.get(id) ?? 0;
const relevantCount = (rel: Judgments) => [...rel.values()].filter((g) => g > 0).length;

export function precisionAt(ranked: readonly string[], rel: Judgments, k: number): number {
  return ranked.slice(0, k).filter((id) => grade(rel, id) > 0).length / k;
}

export function recallAt(ranked: readonly string[], rel: Judgments, k: number): number {
  const total = relevantCount(rel);
  return total === 0 ? 0 : ranked.slice(0, k).filter((id) => grade(rel, id) > 0).length / total;
}

export function reciprocalRank(ranked: readonly string[], rel: Judgments): number {
  const i = ranked.findIndex((id) => grade(rel, id) > 0);
  return i < 0 ? 0 : 1 / (i + 1);
}

export function averagePrecision(ranked: readonly string[], rel: Judgments): number {
  const total = relevantCount(rel);
  if (total === 0) return 0;
  let hits = 0;
  let sum = 0;
  ranked.forEach((id, i) => {
    if (grade(rel, id) > 0) sum += ++hits / (i + 1);
  });
  return sum / total;
}

/** nDCG@k with linear gain and log2 discount, the trec_eval convention. */
export function ndcgAt(ranked: readonly string[], rel: Judgments, k: number): number {
  const dcg = (grades: number[]) => grades.slice(0, k).reduce((sum, g, i) => sum + g / Math.log2(i + 2), 0);
  const ideal = dcg([...rel.values()].filter((g) => g > 0).sort((a, b) => b - a));
  return ideal === 0 ? 0 : dcg(ranked.map((id) => grade(rel, id))) / ideal;
}

export interface EvalResult {
  perQuery: Record<string, Record<string, number>>;
  mean: Record<string, number>;
}

/** Scores every judged query; queries missing from the run score 0, like trec_eval -c. */
export function evaluateRun(
  run: ReadonlyMap<string, readonly string[]>,
  qrels: ReadonlyMap<string, Judgments>,
  k = 10,
): EvalResult {
  const perQuery: EvalResult["perQuery"] = {};
  for (const [qid, rel] of qrels) {
    const ranked = run.get(qid) ?? [];
    perQuery[qid] = {
      [`P@${k}`]: precisionAt(ranked, rel, k),
      [`Recall@${k}`]: recallAt(ranked, rel, k),
      [`nDCG@${k}`]: ndcgAt(ranked, rel, k),
      MRR: reciprocalRank(ranked, rel),
      MAP: averagePrecision(ranked, rel),
    };
  }
  const rows = Object.values(perQuery);
  const mean: EvalResult["mean"] = {};
  for (const measure of Object.keys(rows[0] ?? {})) {
    mean[measure] = rows.reduce((sum, row) => sum + row[measure], 0) / rows.length;
  }
  return { perQuery, mean };
}
