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
    description: "Roll one or more dice with the seeded rng; sums, doubles, rerolls, and dice pools for chance and push-your-luck.",
    tags: ["dice", "roll", "luck", "chance", "random"],
    families: ["race", "bluff"],
    status: "planned",
  },
  {
    id: "mech:track",
    kind: "mechanic",
    title: "Track movement",
    description: "Move pawns forward along a looping or linear track of spaces by a rolled amount; home stretch, exact finish, shortcuts.",
    tags: ["track", "race", "move", "spaces", "pawn", "path"],
    families: ["race"],
    status: "planned",
  },
  {
    id: "mech:capture-by-landing",
    kind: "mechanic",
    title: "Capture by landing",
    description: "Landing exactly on an opponent's pawn sends it back to start; safe squares protect pawns.",
    tags: ["capture", "send home", "bump", "safe square", "take-that"],
    families: ["race"],
    status: "planned",
  },
  {
    id: "mech:bidding",
    kind: "mechanic",
    title: "Escalating bids and challenges",
    description:
      "Players make ever-higher claims about hidden information; the next player raises the bid or calls liar, and the loser of the challenge is penalized.",
    tags: ["bid", "bluff", "claim", "challenge", "call liar", "auction"],
    families: ["bluff"],
    status: "planned",
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
