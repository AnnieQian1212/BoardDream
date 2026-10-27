import { describe, expect, it } from "vitest";
import { averagePrecision, Bm25Index, ndcgAt, parseQrels, precisionAt, recallAt, reciprocalRank, tokenize } from "./index";

describe("metrics", () => {
  // d3 is highly relevant, d2 and d5 partially; d5 is never retrieved.
  const rel = new Map([
    ["d2", 1],
    ["d3", 2],
    ["d5", 1],
  ]);
  const ranked = ["d1", "d2", "d3", "d4"];

  it("matches hand-computed values", () => {
    expect(precisionAt(ranked, rel, 3)).toBeCloseTo(2 / 3);
    expect(recallAt(ranked, rel, 3)).toBeCloseTo(2 / 3);
    expect(reciprocalRank(ranked, rel)).toBeCloseTo(1 / 2);
    expect(averagePrecision(ranked, rel)).toBeCloseTo((1 / 2 + 2 / 3) / 3);
    // DCG = 1/log2(3) + 2/log2(4); IDCG = 2 + 1/log2(3) + 1/log2(4)
    expect(ndcgAt(ranked, rel, 3)).toBeCloseTo((1 / Math.log2(3) + 1) / (2 + 1 / Math.log2(3) + 0.5));
  });
});

describe("bm25", () => {
  it("strips plurals", () => {
    expect(tokenize("Captures the moving pieces")).toEqual(["capture", "moving", "piece"]);
  });

  it("ranks the matching document first", () => {
    const index = new Bm25Index([
      { id: "grid", text: "square grid board with cells and neighbors" },
      { id: "dice", text: "roll dice and move pawns along a track" },
      { id: "bid", text: "bid on hidden dice and call liar" },
    ]);
    expect(index.search("move pawn around the track after a dice roll")[0].id).toBe("dice");
  });
});

describe("trec", () => {
  it("parses qrels", () => {
    const qrels = parseQrels("q1 0 d1 2\nq1 0 d2 0\nq2 0 d3 1\n");
    expect(qrels.get("q1")?.get("d1")).toBe(2);
    expect(qrels.get("q2")?.size).toBe(1);
  });
});
