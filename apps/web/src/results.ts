import type { GameProfile } from "@boarddream/engine";
import referenceStats from "./reference-stats.json";

/**
 * The numbers on the results page. The eval figures are copied from the eval READMEs (their runs
 * cache every model reply, so they reproduce for free); the reference-game figures come from
 * `npm run eval:reference`, which writes reference-stats.json.
 */

const REPO = "https://github.com/AnnieQian1212/BoardDream/blob/main";

export const UPDATED = "Nov 2, 2026";

/** Where the reference games' balance and profile figures are written up. */
export const plan = `${REPO}/docs/PLAN.md`;

export const retrieval = {
  source: `${REPO}/eval/retrieval/README.md`,
  queries: 63,
  entries: 50,
  systems: [
    { name: "BM25", ndcg: 0.809, recall: 0.794, mrr: 0.936, map: 0.645 },
    { name: "+ Muse Spark query expansion", ndcg: 0.895, recall: 0.909, mrr: 0.992, map: 0.767 },
    { name: "+ Muse Spark rerank", ndcg: 0.969, recall: 0.966, mrr: 1.0, map: 0.929 },
  ],
};

export const generation = {
  source: `${REPO}/eval/generation/README.md`,
  ideas: 24,
  firstDraft: 16,
  afterOneRepair: 24,
  plannerWinRate: 0.78,
  fairShare: 0.34,
  measured: 20,
  planningPays: 18,
  cost: "$4.09",
  groups: [
    { name: "Engine and deck builders", ideas: 4, firstDraft: 4, passed: 4, planner: 0.51 },
    { name: "Worker placement and majorities", ideas: 4, firstDraft: 4, passed: 4, planner: 0.96 },
    { name: "Map, trade and build", ideas: 4, firstDraft: 2, passed: 4, planner: 0.82 },
    { name: "Tile placement", ideas: 4, firstDraft: 3, passed: 4, planner: 0.84 },
    { name: "Drafting, sets and deck building", ideas: 4, firstDraft: 1, passed: 4, planner: 0.78 },
    { name: "Hidden roles, bluffing and co-op", ideas: 4, firstDraft: 2, passed: 4, planner: undefined },
  ],
};

export const opponents = {
  source: `${REPO}/eval/opponents/README.md`,
  rows: [
    { model: "Muse Spark 1.3", game: "Liar's Dice", against: "the probability bot", games: 20, winRate: 0.7, fair: 0.5 },
    { model: "Muse Spark 1.3", game: "Lantern Isles", against: "two heuristic bots", games: 9, winRate: 0.33, fair: 1 / 3 },
    { model: "Muse Spark Open", game: "Liar's Dice", against: "the probability bot", games: 50, winRate: 0.46, fair: 0.5 },
    { model: "Muse Spark Open", game: "Lantern Isles", against: "two heuristic bots", games: 15, winRate: 0.2, fair: 1 / 3 },
  ],
};

export const art = {
  source: plan,
  game: "Lantern Isles",
  tiles: 19,
  aligned: 19,
  meanIoU: "0.87–0.89",
};

export interface ReferenceStats {
  id: string;
  name: string;
  family: string;
  mode: string;
  /** Per table size: each seat's win rate, or for hidden-role games the share the larger side wins. */
  balance: { numPlayers: number; games: number; winRateBySeat?: number[]; majorityWins?: number }[];
  profile: GameProfile;
}

/** The demo games' figures; Glasshouse is measured too but no longer offered. */
export const reference = (referenceStats as ReferenceStats[]).filter((r) => r.id !== "glasshouse");
