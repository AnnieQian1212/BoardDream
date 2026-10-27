import type { GameFamily } from "@boarddream/engine";

/** A retrievable library entry: a verified mechanic module or a reference game. */
export interface CatalogEntry {
  id: string;
  kind: "mechanic" | "game";
  title: string;
  /** Retrieval text: what it does, when a designer would reach for it, the words people use for it. */
  description: string;
  tags: string[];
  families: GameFamily[];
  /** How generated rules reach it. */
  usage?: string;
  /** Source file relative to packages/library/src, shown to the designer model as a reference. */
  source?: string;
  /** "planned" entries are indexed for retrieval evaluation but have no code yet. */
  status: "ready" | "planned";
}

/** The text an entry is indexed under. */
export const catalogText = (entry: CatalogEntry) => `${entry.title}. ${entry.description} ${entry.tags.join(", ")}`;

export const catalog: CatalogEntry[] = [
  {
    id: "mech:square-grid",
    kind: "mechanic",
    title: "Square grid board",
    description:
      "Rectangular board of square cells stored row-major. Bounds checks, orthogonal and diagonal neighbors, index and coordinate conversion.",
    tags: ["board", "grid", "cells", "adjacency", "neighbors", "coordinates"],
    families: ["grid"],
    usage: 'require("@boarddream/mechanics").grid',
    source: "mechanics/grid.ts",
    status: "ready",
  },
  {
    id: "mech:line-win",
    kind: "mechanic",
    title: "K-in-a-row win condition",
    description:
      "Win by forming an unbroken straight line of k of your pieces horizontally, vertically or diagonally. Connect, align, row, five in a row.",
    tags: ["win condition", "line", "row", "connect", "align", "pattern"],
    families: ["grid"],
    usage: "grid.completesLine(shape, cells, x, y, k)",
    source: "mechanics/grid.ts",
    status: "ready",
  },
  {
    id: "mech:gravity-drop",
    kind: "mechanic",
    title: "Gravity drop placement",
    description:
      "Pieces are dropped into a column and fall to the lowest empty cell, as in drop-in-column games. Players choose a column, not a cell.",
    tags: ["placement", "gravity", "drop", "column", "stack"],
    families: ["grid"],
    usage: "grid.dropTarget(shape, cells, x)",
    source: "mechanics/grid.ts",
    status: "ready",
  },
  {
    id: "game:line-up",
    kind: "game",
    title: "Line Up (m,n,k-game)",
    description:
      "Players take turns claiming cells on a grid; first to make a straight line of k wins. Tic-tac-toe, gomoku, and with gravity a drop-in-column game.",
    tags: ["abstract", "perfect information", "placement", "line", "two player", "tic-tac-toe", "gomoku"],
    families: ["grid"],
    source: "games/line-up.ts",
    status: "ready",
  },
  {
    id: "mech:dice",
    kind: "mechanic",
    title: "Dice rolling",
    description:
      "Roll one or more dice with the seeded rng, count dice showing a face (with wild faces), and compute the binomial odds that at least k dice match. Chance, luck and push-your-luck.",
    tags: ["dice", "roll", "luck", "chance", "random", "probability", "odds"],
    families: ["race", "bluff"],
    usage: 'require("@boarddream/mechanics").dice',
    source: "mechanics/dice.ts",
    status: "ready",
  },
  {
    id: "mech:track",
    kind: "mechanic",
    title: "Track movement",
    description:
      "Pawns move forward along a looping track of squares by a rolled amount, each player entering at their own start square and going once around to home.",
    tags: ["track", "race", "move", "spaces", "pawn", "path", "loop"],
    families: ["race"],
    usage: 'require("@boarddream/mechanics").track',
    source: "mechanics/track.ts",
    status: "ready",
  },
  {
    id: "mech:capture-by-landing",
    kind: "mechanic",
    title: "Capture by landing",
    description: "Landing exactly on an opponent's pawn sends it back to start; safe squares protect pawns.",
    tags: ["capture", "send home", "bump", "safe square", "take-that"],
    families: ["race"],
    usage: "see applyMove in Race Home",
    source: "games/race-home.ts",
    status: "ready",
  },
  {
    id: "mech:bidding",
    kind: "mechanic",
    title: "Escalating bids and challenges",
    description:
      "Players make ever-higher claims about hidden information; the next player raises the bid or calls liar, and the loser of the challenge is penalized.",
    tags: ["bid", "bluff", "claim", "challenge", "call liar", "auction", "raise"],
    families: ["bluff"],
    usage: 'require("@boarddream/mechanics").bidding',
    source: "mechanics/bidding.ts",
    status: "ready",
  },
  {
    id: "mech:hidden-information",
    kind: "mechanic",
    title: "Hidden information",
    description:
      "Each player holds secrets (dice under a cup, a hand of cards, a role) that others cannot see. view() redacts them per player and geometry(state, viewer) draws them face down.",
    tags: ["hidden", "secret", "private", "imperfect information", "cup", "hand", "face down"],
    families: ["bluff"],
    usage: "implement view(state, player) and geometry(state, viewer); see Liar's Dice",
    source: "games/liars-dice.ts",
    status: "ready",
  },
  {
    id: "game:race-home",
    kind: "game",
    title: "Race Home (Pachisi-style race)",
    description:
      "Roll a die and race pawns once around a looping track into home; landing on a rival sends it back to base, start squares are safe, a six rolls again, and a round limit ends long games.",
    tags: ["race", "dice", "track", "capture", "luck", "pachisi", "roll and move"],
    families: ["race"],
    source: "games/race-home.ts",
    status: "ready",
  },
  {
    id: "game:liars-dice",
    kind: "game",
    title: "Liar's Dice",
    description:
      "Everyone rolls dice in secret and players raise bids on how many of a face are on the whole table, or call liar; whoever is wrong loses a die and the last player with dice wins.",
    tags: ["bluff", "dice", "bidding", "hidden information", "call liar", "elimination"],
    families: ["bluff"],
    source: "games/liars-dice.ts",
    status: "ready",
  },
  {
    id: "mech:hidden-roles",
    kind: "mechanic",
    title: "Hidden roles",
    description:
      "Secretly deal roles or teams; each player sees only their own role. Social deduction, traitors, werewolves, spies.",
    tags: ["hidden role", "secret team", "social deduction", "traitor", "werewolf", "imperfect information"],
    families: ["bluff"],
    status: "planned",
  },
  {
    id: "mech:voting",
    kind: "mechanic",
    title: "Voting and elimination",
    description: "Discussion then simultaneous voting; the player with most votes is eliminated or exiled. Majority, ties, abstain.",
    tags: ["vote", "elimination", "majority", "exile", "discussion", "simultaneous"],
    families: ["bluff"],
    status: "planned",
  },
];
