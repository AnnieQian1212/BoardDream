import type { Bot, PlayerId } from "@boarddream/engine";
import { boardFor, placeHeld, regionAwards, regionPresence, valleyIndex, valleyRegions, wildmere, type WildmereMove, type WildmereState } from "../games/wildmere";
import { WILDMERE_TILES } from "../games/wildmere-tiles";
import { majorityAwards } from "../mechanics/majority";
import { distinctRotations, frontier } from "../mechanics/tiles";

/**
 * How good a position looks for `seat`, against the rivals' average: points and funds, a ranger in
 * hand, and a share of each unfinished region as it would score now (less the more edges it still
 * has open).
 */
export function wildmereValue(s: WildmereState, seat: PlayerId): number {
  const worth = s.points.map((p, i) => p + s.funds[i] / 3 + 0.5 * s.rangersLeft[i]);
  if (!s.over) {
    const index = valleyIndex(s);
    for (const region of valleyRegions(s)) {
      if (region.open === 0) continue;
      const awards = majorityAwards(regionPresence(s, region, index), regionAwards(region.cells.length, s.numPlayers));
      const sure = 0.75 / (1 + 0.15 * region.open);
      awards.forEach((p, i) => (worth[i] += p * sure));
    }
  }
  const rivals = worth.filter((_, i) => i !== seat);
  return worth[seat] - rivals.reduce((sum, w) => sum + w, 0) / Math.max(1, rivals.length);
}

/** The best cell and rotation for the held tile, by the value of the position right after. */
function bestPlacement(s: WildmereState, seat: PlayerId): { cell: string; rotation: number; value: number } {
  let best = { cell: "", rotation: 0, value: -Infinity };
  const rotations = distinctRotations(WILDMERE_TILES[s.held!.tile]);
  for (const cell of frontier(boardFor(s.radius), s.placed)) {
    for (const rotation of rotations) {
      const value = wildmereValue(placeHeld(s, seat, cell, rotation), seat);
      if (value > best.value) best = { cell, rotation, value };
    }
  }
  return best;
}

/**
 * Greedy Wildmere player: takes the tile whose best placement looks best after paying for it,
 * turns it to that rotation, lays it, and stations a ranger when that raises its outlook.
 */
export function wildmereBot(): Bot {
  // The search done when choosing a tile is reused while turning and laying it.
  const plans = new Map<string, ReturnType<typeof bestPlacement>>();
  const plan = (s: WildmereState, seat: PlayerId) => {
    const key = `${seat}|${s.held!.tile}|${Object.keys(s.placed).join(" ")}`;
    if (!plans.has(key)) {
      if (plans.size > 64) plans.clear();
      plans.set(key, bestPlacement(s, seat));
    }
    return plans.get(key)!;
  };
  return ({ state, player, moves, rng }) => {
    const s = state as WildmereState;
    const legal = moves as WildmereMove[];
    const jitter = () => rng.next() * 0.01;
    if (s.phase === "take") {
      let pick = legal[0];
      let top = -Infinity;
      for (const move of legal) {
        const value = plan(wildmere.applyMove(s, player, move, rng), player).value + jitter();
        if (value > top) [pick, top] = [move, value];
      }
      return pick;
    }
    if (s.phase === "place") {
      const target = plan(s, player);
      const turns = (target.rotation - s.held!.rotation + 6) % 6;
      const canTurn = legal.some((m) => m.type === "turn");
      if (turns !== 0 && canTurn) return { type: "turn", dir: turns <= 3 ? 1 : -1 };
      if (turns === 0) return { type: "place", cell: target.cell };
      // Out of turns: the best cell for the tile as it lies.
      return { type: "place", cell: bestPlacementAsIs(s, player) };
    }
    let pick = legal[legal.length - 1];
    let top = -Infinity;
    for (const move of legal) {
      const value = wildmereValue(wildmere.applyMove(s, player, move, rng), player) + jitter();
      if (value > top) [pick, top] = [move, value];
    }
    return pick;
  };
}

function bestPlacementAsIs(s: WildmereState, seat: PlayerId): string {
  const cells = frontier(boardFor(s.radius), s.placed);
  return cells.reduce((best, cell) => (wildmereValue(placeHeld(s, seat, cell), seat) > wildmereValue(placeHeld(s, seat, best), seat) ? cell : best));
}
