# Retrieval evaluation

Given a player's game idea, BoardDream retrieves mechanic modules and reference games from its library and hands the best ones to the compose step. This evaluation measures how well each retrieval system ranks the library for an idea.

## Setup

- **Collection:** the 39 entries in `packages/library/src/catalog.ts`: 25 with code (18 mechanics, 7 reference games) and 14 planned mechanics without code. Planned entries stay in the collection as realistic near-misses (an open auction next to bluff bidding, tile placement next to hex tiles); the designer itself only retrieves entries with code.
- **Queries:** 50 game ideas in `queries.jsonl`, written the way players describe games rather than in catalog vocabulary. Several are deliberate traps: "connect four" (q38) is a k-in-a-row game, not a connection game; "bidding coins for paintings" (q13) is an auction, not a bluff; "tiles" on a hexagon board (q07) is a connection game, not tile placement.
- **Judgments:** `qrels.txt`, TREC format, graded 0–2:
  - **2:** the game cannot be built without this mechanic, or this reference game is a close template.
  - **1:** useful but not essential, e.g. a generic helper the idea explicitly needs, or a related reference game.
  - unlisted entries are 0.
- **Judgment status:** drafted on Oct 27, 2026 with Claude (Anthropic) during development, pending review by the author. They were deliberately not drafted with Muse Spark, which is the model under test in two of the three systems.
- **Measures:** P@10, Recall@10, nDCG@10 (linear gain, as in trec_eval), MRR, MAP.

## Systems

| System | What it does |
| --- | --- |
| `bm25` | Okapi BM25 (k1 1.2, b 0.75) over each entry's title, description and tags; S-stemmer |
| `bm25+expand` | Muse Spark rewrites the idea into 3–8 mechanic names and synonyms, appended to the BM25 query |
| `bm25+expand+rerank` | Muse Spark reorders the top 20 of `bm25+expand` by how directly the game needs each entry; entries it leaves out keep their order after the ones it ranks |

Model: `muse-spark-1.3` with structured output; prompts in `apps/server/src/agent/retrieve.ts`. The designer pipeline uses the third system.

## Results (Oct 27, 2026)

| System | P@10 | Recall@10 | nDCG@10 | MRR | MAP |
| --- | --- | --- | --- | --- | --- |
| `bm25` | 0.234 | 0.851 | 0.845 | 0.953 | 0.692 |
| `bm25+expand` | 0.262 | 0.957 | 0.905 | 0.977 | 0.785 |
| `bm25+expand+rerank` | 0.270 | 0.988 | **0.969** | 0.990 | **0.929** |

- Per query on nDCG@10, expansion beats BM25 on 25 queries, ties on 16 and loses on 9; expansion plus rerank beats it on 36, ties on 7 and loses on 7.
- Most of the rerank losses are small reorderings among relevant entries, e.g. a grade-1 helper placed above a grade-2 template (q05 drops from 1.00 to 0.97).
- P@10 is low for every system by construction: most queries have only 2–4 relevant entries.
- All numbers match `ir_measures` to four decimals. BM25 breaks score ties the way trec_eval does, so the run files evaluate identically in both.
- The full run makes 100 Muse Spark calls and cost about $0.82, almost all of it reasoning tokens.

### For judgment review

- q27 ("most pieces wins") lists `game:reversi` but not `mech:flanking`, which Reversi needs; the reranker put flanking first. Decide this consistently with q06 and q46 rather than to suit any one system.
- Judgments come from a single annotator who also wrote the catalog descriptions and the queries. A second annotator would let us report agreement.

## Reproduce

```sh
npm run eval:retrieval        # prints the table; writes TREC runs to eval/retrieval/out/
ir_measures eval/retrieval/qrels.txt eval/retrieval/out/bm25+expand+rerank.run nDCG@10 R@10 RR AP P@10
```

Every Muse Spark reply is cached in `cache/`, keyed by model, prompt and options, so a rerun makes no API calls and the files record exactly what the model was asked and answered. A rerun with changed prompts or catalog calls the API for the new requests only, then deletes cache files the run no longer uses.
