import type { PlayerId } from "@boarddream/engine";

/**
 * Area majority: players build presence in regions, and whoever has the most in a region controls
 * it and scores it; second place often scores less. Games decide when regions score (every round,
 * a few scoring rounds, game end).
 */

/** Region id to each seat's presence there (pieces, influence cubes, buildings). */
export type Presence = Record<string, number[]>;

/** Presence counts from a list of owned pieces in regions. */
export function presence(regions: readonly string[], numPlayers: number, pieces: readonly { region: string; owner: PlayerId }[]): Presence {
  const counts: Presence = Object.fromEntries(regions.map((region) => [region, new Array<number>(numPlayers).fill(0)]));
  for (const { region, owner } of pieces) counts[region][owner]++;
  return counts;
}

/** Seats with any presence, grouped by count from most to least; tied seats share a group. */
export function standings(counts: readonly number[]): PlayerId[][] {
  const levels = [...new Set(counts.filter((n) => n > 0))].sort((a, b) => b - a);
  return levels.map((level) => counts.flatMap((n, seat) => (n === level ? [seat] : [])));
}

/** The seat with strictly the most presence, or undefined when nobody is there or the lead is tied. */
export function controller(counts: readonly number[]): PlayerId | undefined {
  const [first] = standings(counts);
  return first?.length === 1 ? first[0] : undefined;
}

/**
 * Points each seat scores in one region. `awards` lists the points for first, second, ... place.
 * Tied seats share the places they span, rounded down: two tied for first with awards [6, 3] get 4
 * each, and the next seat is third.
 */
export function majorityAwards(counts: readonly number[], awards: readonly number[]): number[] {
  const points = counts.map(() => 0);
  let place = 0;
  for (const group of standings(counts)) {
    if (place >= awards.length) break;
    const pot = awards.slice(place, place + group.length).reduce((sum, n) => sum + n, 0);
    for (const seat of group) points[seat] = Math.floor(pot / group.length);
    place += group.length;
  }
  return points;
}

/** Points per seat for every region at once. */
export function scoreRegions(counts: Presence, awardsFor: (region: string) => readonly number[], numPlayers: number): number[] {
  const total = new Array<number>(numPlayers).fill(0);
  for (const [region, bySeat] of Object.entries(counts)) {
    majorityAwards(bySeat, awardsFor(region)).forEach((points, seat) => (total[seat] += points));
  }
  return total;
}
