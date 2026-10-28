import type { ResourceSpec } from "@boarddream/engine";
import type { CardDef } from "../mechanics/effects";

export const HIGHSAIL_RESOURCES: ResourceSpec[] = [
  { id: "timber", name: "Timber", icon: "tree", color: "#5f8f4e" },
  { id: "crystal", name: "Crystal", icon: "gem", color: "#7d6bd1" },
  { id: "fuel", name: "Fuel", icon: "flame", color: "#e0703c" },
  { id: "coins", name: "Coins", icon: "coins", color: "#d6a93a" },
];

export interface Island {
  id: string;
  name: string;
  /** Points for the most outposts and the second most (second place needs 3+ players). */
  awards: [number, number];
}

export const ISLANDS: Island[] = [
  { id: "ironcrag", name: "Ironcrag", awards: [6, 3] },
  { id: "mistwood", name: "Mistwood", awards: [5, 2] },
  { id: "emberfall", name: "Emberfall", awards: [5, 2] },
  { id: "saltspire", name: "Saltspire", awards: [4, 2] },
  { id: "lowhaven", name: "Lowhaven", awards: [3, 1] },
];

/**
 * 24 charters. Each names the island where launching it puts an outpost (its first tag) and a kind:
 * cargo scores now, survey pays income every round, envoy scores at game end.
 */
export const HIGHSAIL_CHARTERS: CardDef[] = [
  // Cargo: points now
  { id: "crystal-lanterns", name: "Crystal Lanterns", cost: { crystal: 2, fuel: 1 }, points: 4, tags: ["ironcrag", "cargo"] },
  { id: "timber-barges", name: "Timber Barges", cost: { timber: 3 }, points: 4, tags: ["mistwood", "cargo"] },
  { id: "ember-glass", name: "Ember Glass", cost: { crystal: 1, fuel: 2 }, points: 4, tags: ["emberfall", "cargo"] },
  { id: "salt-and-spice", name: "Salt and Spice", cost: { timber: 1, crystal: 1, fuel: 1 }, points: 3, tags: ["saltspire", "cargo"], onPlay: [{ gain: { coins: 2 } }] },
  { id: "market-run", name: "Market Run", cost: { timber: 2 }, points: 2, tags: ["lowhaven", "cargo"], onPlay: [{ gain: { coins: 2 } }] },
  { id: "skyglass-organ", name: "Skyglass Organ", cost: { crystal: 3, timber: 2 }, points: 7, tags: ["ironcrag", "cargo"] },
  { id: "fleet-provisions", name: "Fleet Provisions", cost: { timber: 2, fuel: 2 }, points: 5, tags: ["saltspire", "cargo"] },
  { id: "grand-cargo", name: "Grand Bazaar Cargo", cost: { timber: 2, crystal: 2, fuel: 2 }, points: 8, tags: ["lowhaven", "cargo"] },
  // Survey: income every round
  { id: "cloud-forest", name: "Cloud Forest Survey", cost: { fuel: 1, coins: 1 }, points: 1, tags: ["mistwood", "survey"], income: [{ gain: { timber: 1 } }] },
  { id: "deep-seam", name: "Deep Seam Survey", cost: { timber: 1, fuel: 1 }, points: 1, tags: ["ironcrag", "survey"], income: [{ gain: { crystal: 1 } }] },
  { id: "vent-survey", name: "Vent Survey", cost: { timber: 2 }, points: 1, tags: ["emberfall", "survey"], income: [{ gain: { fuel: 1 } }] },
  { id: "harbor-tolls", name: "Harbor Tolls", cost: { timber: 1, crystal: 1 }, points: 1, tags: ["lowhaven", "survey"], income: [{ gain: { coins: 2 } }] },
  { id: "wind-charts", name: "Wind Charts", cost: { crystal: 1, timber: 1 }, points: 0, tags: ["saltspire", "survey"], income: [{ gain: { coins: 2 } }] },
  {
    id: "refinery-contract",
    name: "Refinery Contract",
    cost: { crystal: 1, timber: 1 },
    points: 2,
    tags: ["emberfall", "survey"],
    income: [{ convert: { give: { timber: 1 }, get: { fuel: 2 } } }],
  },
  { id: "sawmill", name: "Sawmill Charter", cost: { fuel: 2 }, points: 2, tags: ["mistwood", "survey"], income: [{ gain: { timber: 1 } }] },
  {
    id: "survey-guild",
    name: "Survey Guild",
    cost: { timber: 1, fuel: 1, crystal: 1 },
    points: 2,
    tags: ["saltspire", "survey"],
    income: [{ gainPerTag: { tag: "survey", resource: "timber", amount: 1 } }],
  },
  // Envoy: points at game end
  { id: "ironcrag-envoy", name: "Ironcrag Envoy", cost: { crystal: 2, coins: 2 }, points: 2, tags: ["ironcrag", "envoy"], endgame: [{ pointsPerTag: { tag: "cargo", points: 1 } }] },
  { id: "mistwood-accord", name: "Mistwood Accord", cost: { timber: 2, crystal: 1 }, points: 2, tags: ["mistwood", "envoy"], endgame: [{ pointsPerTag: { tag: "survey", points: 1 } }] },
  { id: "emberfall-pact", name: "Emberfall Pact", cost: { fuel: 2, crystal: 1 }, points: 3, tags: ["emberfall", "envoy"], endgame: [{ pointsPerTag: { tag: "envoy", points: 1 } }] },
  {
    id: "saltspire-treaty",
    name: "Saltspire Treaty",
    cost: { timber: 1, fuel: 1, coins: 2 },
    points: 2,
    tags: ["saltspire", "envoy"],
    endgame: [{ pointsPerTag: { tag: "saltspire", points: 2 } }],
  },
  { id: "lowhaven-charter", name: "Lowhaven Charter", cost: { coins: 3, timber: 1 }, points: 2, tags: ["lowhaven", "envoy"], endgame: [{ pointsPerTag: { tag: "lowhaven", points: 2 } }] },
  { id: "admirals-favor", name: "Admiral's Favor", cost: { crystal: 2, fuel: 2 }, points: 4, tags: ["ironcrag", "envoy"], endgame: [{ pointsPerTag: { tag: "ironcrag", points: 1 } }] },
  {
    id: "cartographers-hall",
    name: "Cartographers' Hall",
    cost: { timber: 2, fuel: 1, coins: 1 },
    points: 3,
    tags: ["mistwood", "envoy"],
    endgame: [{ pointsPerTag: { tag: "mistwood", points: 2 } }],
  },
  {
    id: "sky-consulate",
    name: "Sky Consulate",
    cost: { timber: 1, crystal: 2, fuel: 1 },
    points: 4,
    tags: ["emberfall", "envoy"],
    endgame: [{ pointsPerTag: { tag: "emberfall", points: 2 } }],
  },
];
