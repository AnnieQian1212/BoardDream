/** Seat colors: coral, steel blue, mustard, sage, plum, rose. Tuned to read on light wood, pastel mats and card paper. */
export const PLAYER_COLORS = ["#dd6448", "#3f7fc2", "#d0961f", "#4f9a6c", "#9467c2", "#d06688"];

export const playerColor = (seat: number | undefined) => PLAYER_COLORS[(seat ?? 0) % PLAYER_COLORS.length];

/** Board tile kinds with a color of their own, shared by the 3D table and the flat board. */
export const TILE_COLORS: Record<string, string> = {
  ladder: "#bcd9b0",
  snake: "#f0c0b2",
  // Map terrains.
  forest: "#6f9a5a",
  quarry: "#a6a59d",
  fields: "#e2c463",
  reef: "#6eaed6",
  lagoon: "#9cd3cb",
  vertex: "#f3ead8",
  edge: "#e6dac2",
  // Highsail: the skyport's action spaces and the five sky islands.
  skyport: "#efe4cf",
  ironcrag: "#a9a6a0",
  mistwood: "#7fa86a",
  emberfall: "#e39a6b",
  saltspire: "#e6dcc4",
  lowhaven: "#8cc9c0",
  // Wildmere: the valley's terrains, its empty spaces and the spaces a tile can go next.
  woodland: "#5f9654",
  meadow: "#e3c35c",
  wetland: "#5fa8d3",
  heath: "#b083c2",
  slot: "#e4dcc6",
  frontier: "#efe2bd",
  // Fenlight: lanterns as the lookout saw them at dawn, and the village's players.
  lantern: "#e8dcc2",
  "lit-lantern": "#f2c45a",
  "dark-lantern": "#56607a",
  villager: "#efe4cf",
  "known-wisp": "#9fd0c8",
  "exiled-keeper": "#c9c0b4",
  "exiled-wisp": "#a99bc4",
};
