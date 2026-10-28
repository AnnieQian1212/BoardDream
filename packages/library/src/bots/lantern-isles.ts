import type { Bot, PlayerId } from "@boarddream/engine";
import {
  COSTS,
  LANTERN_MAP,
  lanternScore,
  lanternSpots,
  piecesLeft,
  terrainOf,
  tileYield,
  type LanternMove,
  type LanternState,
} from "../games/lantern-isles";
import { canSettle, lookup, settleSpots } from "../mechanics/hexmap";
import { cornerYield } from "../mechanics/production";
import { amountOf, shortfall, total, type Amounts } from "../mechanics/resources";

/** How good a corner is to build on: expected yield, variety, and a lagoon to light later. */
function cornerValue(s: LanternState, vertex: string): number {
  const gain = cornerYield(LANTERN_MAP, vertex, (t) => tileYield(s, t));
  const lagoon = lookup(LANTERN_MAP).vertex.get(vertex)!.tiles.some((t) => terrainOf(s, t) === "lagoon");
  return total(gain) + Object.keys(gain).length * 0.6 + (lagoon ? 0.4 : 0);
}

/** Best corner reachable by a road along `edge`: its far end, or a corner one step past it. */
function roadValue(s: LanternState, edge: string, seat: PlayerId): number {
  const { edge: edges, vertex } = lookup(LANTERN_MAP);
  let best = 0;
  for (const end of edges.get(edge)!.ends) {
    if (s.buildings[end]) continue;
    for (const v of [end, ...vertex.get(end)!.neighbors]) {
      if (canSettle(LANTERN_MAP, s.buildings, s.roads, v, seat, false)) best = Math.max(best, cornerValue(s, v) - (v === end ? 0 : 0.5));
    }
  }
  return best;
}

/** The cheapest next build still available to the seat, as a cost to save toward. */
function goal(s: LanternState, seat: PlayerId): Amounts | undefined {
  const pool = s.resources[seat];
  const left = piecesLeft(s, seat);
  const options: Amounts[] = [];
  const spots = settleSpots(LANTERN_MAP, s.buildings, s.roads, seat, true);
  if (left.village > 0 && spots.length > 0) options.push(COSTS.village);
  if (left.town > 0 && Object.values(s.buildings).some((b) => b.owner === seat && b.level === 1)) options.push(COSTS.town);
  if (lanternSpots(s, seat).length > 0) options.push(COSTS.lantern);
  if (left.village > 0 && spots.length === 0 && left.road > 0) options.push(COSTS.road);
  if (options.length === 0) return undefined;
  return options.reduce((a, b) => (total(shortfall(pool, b)) < total(shortfall(pool, a)) ? b : a));
}

/** Units of `resource` the seat can spare after saving for its goal. */
const spare = (pool: Amounts, target: Amounts | undefined, resource: string) => amountOf(pool, resource) - amountOf(target ?? {}, resource);

/**
 * Heuristic Lantern Isles player: settles the richest, most varied corners, builds whatever scores
 * (town, village, lantern), lays roads only to reach a new village spot, and trades its surplus for
 * the one resource it is missing, refusing to help a player close to winning.
 */
export function lanternIslesBot(): Bot {
  return ({ state, player, moves, rng }) => {
    const s = state as LanternState;
    const options = moves as LanternMove[];
    const pick = <T extends LanternMove>(list: T[], score: (m: T) => number) =>
      list.map((m) => ({ m, v: score(m) + rng.next() * 0.01 })).reduce((a, b) => (b.v > a.v ? b : a)).m;
    const of = <K extends LanternMove["type"]>(type: K) => options.filter((m): m is Extract<LanternMove, { type: K }> => m.type === type);
    const pool = s.resources[player];

    // Answering an offer: take it when it fills a gap without costing anything the goal needs.
    if (s.phase === "offer" && s.offer) {
      const accept = options.find((m) => m.type === "accept");
      const target = goal(s, player);
      const receive = Object.keys(s.offer.give)[0];
      const pay = Object.keys(s.offer.get)[0];
      const helps = amountOf(shortfall(pool, target ?? {}), receive) > 0;
      const affordable = spare(pool, target, pay) >= 1;
      const safe = lanternScore(s, s.offer.from) < s.target - 2;
      return accept && helps && affordable && safe ? accept : options.find((m) => m.type === "decline")!;
    }

    if (s.phase === "setup") {
      const settles = of("settle");
      if (settles.length > 0) return pick(settles, (m) => cornerValue(s, m.vertex));
      return pick(of("road"), (m) => roadValue(s, m.edge, player));
    }

    // Anything that wins the game now.
    const scoring = [...of("town"), ...of("village"), ...of("lantern")];
    const gain = (m: LanternMove) => (m.type === "village" ? 1 : m.type === "town" ? 1 : 2);
    const winning = scoring.find((m) => lanternScore(s, player) + gain(m) >= s.target);
    if (winning) return winning;

    const towns = of("town");
    if (towns.length > 0) return pick(towns, (m) => cornerValue(s, m.vertex));
    const villages = of("village");
    if (villages.length > 0) return pick(villages, (m) => cornerValue(s, m.vertex));
    const lanterns = of("lantern");
    if (lanterns.length > 0) return lanterns[0];
    const roads = of("road");
    if (roads.length > 0 && settleSpots(LANTERN_MAP, s.buildings, s.roads, player, true).length === 0) {
      const best = pick(roads, (m) => roadValue(s, m.edge, player));
      if (roadValue(s, best.edge, player) > 0) return best;
    }

    // Trade toward the goal when exactly one resource is missing.
    const target = goal(s, player);
    const missing = Object.keys(shortfall(pool, target ?? {}));
    if (target && total(shortfall(pool, target)) === 1) {
      const bank = of("bank").filter((m) => missing.includes(m.get) && spare(pool, target, m.give) >= s.bankRate);
      if (bank.length > 0) return pick(bank, (m) => spare(pool, target, m.give));
      const offers = of("offer").filter(
        (m) => missing.includes(m.get) && spare(pool, target, m.give) >= 1 && lanternScore(s, m.to) < s.target - 2,
      );
      if (offers.length > 0) return pick(offers, (m) => amountOf(s.resources[m.to], m.get) - lanternScore(s, m.to) * 0.1);
    }
    return options.find((m) => m.type === "end")!;
  };
}
