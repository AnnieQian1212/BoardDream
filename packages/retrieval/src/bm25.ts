const STOPWORDS = new Set(
  "a an and are as at be by can for from has have in into is it its of on or that the their them then they this to was were when where which while who will with".split(
    " ",
  ),
);

/** Harman's S-stemmer: strips plural endings only, so "captures" and "capture" match. */
function sStem(term: string): string {
  if (term.length > 3 && term.endsWith("ies") && !term.endsWith("eies") && !term.endsWith("aies")) {
    return term.slice(0, -3) + "y";
  }
  if (term.length > 3 && term.endsWith("es") && !/(aes|ees|oes)$/.test(term)) return term.slice(0, -1);
  if (term.length > 2 && term.endsWith("s") && !/(us|ss)$/.test(term)) return term.slice(0, -1);
  return term;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(sStem);
}

export interface Doc {
  id: string;
  text: string;
}

export interface Hit {
  id: string;
  score: number;
}

/** Okapi BM25 with Lucene's non-negative idf. */
export class Bm25Index {
  private readonly postings = new Map<string, { doc: number; tf: number }[]>();
  private readonly ids: string[];
  private readonly lengths: number[];
  private readonly avgLength: number;

  constructor(
    docs: readonly Doc[],
    private readonly k1 = 1.2,
    private readonly b = 0.75,
  ) {
    this.ids = docs.map((d) => d.id);
    this.lengths = [];
    docs.forEach((doc, i) => {
      const terms = tokenize(doc.text);
      this.lengths.push(terms.length);
      const tf = new Map<string, number>();
      for (const term of terms) tf.set(term, (tf.get(term) ?? 0) + 1);
      for (const [term, count] of tf) {
        const list = this.postings.get(term) ?? [];
        list.push({ doc: i, tf: count });
        this.postings.set(term, list);
      }
    });
    this.avgLength = this.lengths.reduce((a, b) => a + b, 0) / Math.max(1, docs.length);
  }

  search(query: string, k = 10): Hit[] {
    const n = this.ids.length;
    const scores = new Map<number, number>();
    for (const term of new Set(tokenize(query))) {
      const list = this.postings.get(term);
      if (!list) continue;
      const idf = Math.log(1 + (n - list.length + 0.5) / (list.length + 0.5));
      for (const { doc, tf } of list) {
        const norm = tf + this.k1 * (1 - this.b + (this.b * this.lengths[doc]) / this.avgLength);
        scores.set(doc, (scores.get(doc) ?? 0) + (idf * tf * (this.k1 + 1)) / norm);
      }
    }
    return [...scores]
      .map(([doc, score]) => ({ id: this.ids[doc], score }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, k);
  }
}
