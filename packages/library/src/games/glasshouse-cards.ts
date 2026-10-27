import type { ResourceSpec } from "@boarddream/engine";
import type { CardDef } from "../mechanics/effects";

export const GLASSHOUSE_RESOURCES: ResourceSpec[] = [
  { id: "water", name: "Water", icon: "droplet", color: "#3d8fd1" },
  { id: "light", name: "Light", icon: "sun", color: "#e3a622" },
  { id: "soil", name: "Soil", icon: "shovel", color: "#a06d42" },
];

/** 32 plants, 38 cards. Cheap plants build the engine; expensive ones and end-game bonuses score. */
export const GLASSHOUSE_CARDS: CardDef[] = [
  // Herbs: cheap engines and card draw
  { id: "mint", name: "Mint", cost: { water: 1 }, points: 0, tags: ["herb"], income: [{ gain: { water: 1 } }], copies: 2 },
  { id: "thyme", name: "Thyme", cost: { light: 1 }, points: 0, tags: ["herb"], income: [{ gain: { light: 1 } }], copies: 2 },
  { id: "basil", name: "Basil", cost: { soil: 1 }, points: 1, tags: ["herb"], onPlay: [{ draw: 1 }], copies: 2 },
  { id: "clover", name: "Clover", cost: { soil: 1 }, points: 0, tags: ["herb"], onPlay: [{ gain: { water: 1, light: 1 } }] },
  { id: "sage", name: "Sage", cost: { soil: 1, light: 1 }, points: 1, tags: ["herb"], endgame: [{ pointsPerTag: { tag: "herb", points: 1 } }] },
  { id: "lavender", name: "Lavender", cost: { light: 2, water: 1 }, points: 2, tags: ["herb", "flower"], income: [{ points: 1 }] },
  // Flowers: points and flower sets
  { id: "poppy", name: "Poppy", cost: { light: 1 }, points: 1, tags: ["flower"], onPlay: [{ gain: { water: 1 } }] },
  { id: "tulip", name: "Tulip", cost: { water: 1, light: 1 }, points: 2, tags: ["flower"] },
  { id: "sunflower", name: "Sunflower", cost: { light: 2, soil: 1 }, points: 2, tags: ["flower"], income: [{ gain: { light: 1 } }] },
  { id: "rose", name: "Rose", cost: { water: 2, light: 2 }, points: 3, tags: ["flower"], endgame: [{ pointsPerTag: { tag: "flower", points: 1 } }] },
  { id: "orchid", name: "Orchid", cost: { water: 2, light: 2, soil: 1 }, points: 6, tags: ["flower", "exotic"] },
  // Trees: expensive, steady
  { id: "oak", name: "Oak Sapling", cost: { soil: 2, water: 2 }, points: 3, tags: ["tree"], endgame: [{ pointsPerTag: { tag: "tree", points: 1 } }] },
  { id: "pine", name: "Pine", cost: { soil: 2, light: 1 }, points: 3, tags: ["tree"], income: [{ gain: { soil: 1 } }] },
  { id: "willow", name: "Willow", cost: { water: 3, soil: 1 }, points: 4, tags: ["tree", "aquatic"], income: [{ gain: { water: 1 } }] },
  { id: "maple", name: "Maple", cost: { soil: 2, light: 2 }, points: 5, tags: ["tree"] },
  { id: "bonsai", name: "Bonsai", cost: { soil: 1, water: 1, light: 1 }, points: 2, tags: ["tree"], onPlay: [{ draw: 2 }] },
  { id: "fig", name: "Strangler Fig", cost: { soil: 2, water: 2, light: 2 }, points: 7, tags: ["tree", "exotic"] },
  // Succulents: run on light
  { id: "aloe", name: "Aloe", cost: { light: 1 }, points: 1, tags: ["succulent"], income: [{ gain: { water: 1 } }], copies: 2 },
  { id: "cactus", name: "Cactus", cost: { light: 1, soil: 1 }, points: 2, tags: ["succulent"], endgame: [{ pointsPerTag: { tag: "succulent", points: 1 } }] },
  { id: "jade", name: "Jade Plant", cost: { light: 2 }, points: 1, tags: ["succulent"], income: [{ points: 1 }] },
  { id: "agave", name: "Agave", cost: { light: 3 }, points: 5, tags: ["succulent"] },
  // Aquatics: water engines
  { id: "lily", name: "Water Lily", cost: { water: 2 }, points: 2, tags: ["aquatic"], income: [{ gain: { light: 1 } }] },
  { id: "lotus", name: "Lotus", cost: { water: 3, light: 1 }, points: 5, tags: ["aquatic", "flower"] },
  { id: "duckweed", name: "Duckweed", cost: { water: 1 }, points: 0, tags: ["aquatic"], income: [{ gainPerTag: { tag: "aquatic", resource: "water", amount: 1 } }] },
  { id: "reed", name: "Reed", cost: { water: 1, soil: 1 }, points: 1, tags: ["aquatic"], onPlay: [{ draw: 1 }] },
  // Ferns and fungi: soil engines
  { id: "moss", name: "Moss", cost: { water: 1 }, points: 0, tags: ["fern"], income: [{ gain: { soil: 1 } }], copies: 2 },
  { id: "fern", name: "Fern", cost: { water: 1, soil: 1 }, points: 1, tags: ["fern"], income: [{ convert: { give: { water: 1 }, get: { light: 2 } } }] },
  { id: "mushroom", name: "Mushroom", cost: { soil: 1 }, points: 1, tags: ["fungus"], income: [{ gain: { soil: 1 } }], copies: 2 },
  { id: "mycelium", name: "Mycelium", cost: { soil: 2 }, points: 0, tags: ["fungus"], income: [{ gainPerTag: { tag: "fungus", resource: "soil", amount: 1 } }] },
  { id: "truffle", name: "Truffle", cost: { soil: 3 }, points: 3, tags: ["fungus"], endgame: [{ pointsPerTag: { tag: "tree", points: 1 } }] },
  // Exotics: points that reward collecting them
  { id: "flytrap", name: "Venus Flytrap", cost: { light: 1, soil: 1, water: 1 }, points: 2, tags: ["exotic"], income: [{ points: 1 }] },
  { id: "pitcher", name: "Pitcher Plant", cost: { water: 2, light: 1 }, points: 3, tags: ["exotic"], endgame: [{ pointsPerTag: { tag: "exotic", points: 2 } }] },
];
