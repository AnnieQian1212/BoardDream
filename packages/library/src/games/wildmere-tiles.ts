import type { ResourceSpec } from "@boarddream/engine";

export const WILDMERE_RESOURCES: ResourceSpec[] = [{ id: "funds", name: "Funds", icon: "coins", color: "#d6a93a" }];

export interface Terrain {
  id: string;
  name: string;
}

export const TERRAINS: Terrain[] = [
  { id: "woodland", name: "Woodland" },
  { id: "meadow", name: "Meadow" },
  { id: "wetland", name: "Wetland" },
  { id: "heath", name: "Heath" },
];

const T = TERRAINS.map((t) => t.id);
const pairs = T.flatMap((a, i) => T.slice(i + 1).map((b) => [a, b]));
const ordered = T.flatMap((a) => T.flatMap((b) => (b === a ? [] : T.filter((c) => c !== a && c !== b).map((c) => [a, b, c]))));
const triples = T.flatMap((a, i) => T.slice(i + 1).flatMap((b, j) => T.slice(i + j + 2).map((c) => [a, b, c])));

/**
 * The 66 valley tiles, one terrain per edge (clockwise from east): every terrain appears equally
 * often. Halves and wedges of two terrains, bands of three, three-two-one splits, five-and-one
 * splits and one solid tile of each terrain.
 */
export const WILDMERE_TILES: string[][] = [
  ...pairs.flatMap(([a, b]) => [
    [a, a, a, b, b, b],
    [a, a, a, a, b, b],
    [b, b, b, b, a, a],
    [a, a, a, a, a, b],
    [b, b, b, b, b, a],
  ]),
  ...triples.flatMap(([a, b, c]) => [
    [a, a, b, b, c, c],
    [a, a, c, c, b, b],
  ]),
  ...ordered.map(([a, b, c]) => [a, a, a, b, b, c]),
  ...T.map((a) => [a, a, a, a, a, a]),
];

/** The neutral tile in the middle of the valley at the start. */
export const START_TILE = ["woodland", "woodland", "meadow", "wetland", "wetland", "heath"];
