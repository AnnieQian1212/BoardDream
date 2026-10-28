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
  /**
   * "planned" entries have no code yet. They stay in the retrieval eval collection as realistic
   * near-misses; the designer only sees "ready" entries.
   */
  status: "ready" | "planned";
}

/** The text an entry is indexed under. */
export const catalogText = (entry: CatalogEntry) => `${entry.title}. ${entry.description} ${entry.tags.join(", ")}`;

const mechanics = (name: string) => `require("@boarddream/mechanics").${name}`;

export const catalog: CatalogEntry[] = [
  // Grid mechanics
  {
    id: "mech:square-grid",
    kind: "mechanic",
    title: "Square grid board",
    description:
      "Rectangular board of square cells stored row-major. Bounds checks, orthogonal and diagonal neighbors, index and coordinate conversion.",
    tags: ["board", "grid", "cells", "adjacency", "neighbors", "coordinates"],
    families: ["grid"],
    usage: mechanics("grid"),
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
    id: "mech:flanking",
    kind: "mechanic",
    title: "Flanking capture",
    description:
      "Placing a piece flips every straight run of rival pieces it traps between itself and another of your own pieces; only placements that flip something are legal.",
    tags: ["capture", "flip", "flank", "sandwich", "trap", "convert", "reversi"],
    families: ["grid"],
    usage: mechanics("flanking"),
    source: "mechanics/flanking.ts",
    status: "ready",
  },
  {
    id: "mech:hex-grid",
    kind: "mechanic",
    title: "Hexagonal grid board",
    description:
      "Board of hexagonal cells in axial coordinates with six neighbors per cell, laid out as a rhombus, with polygons for drawing.",
    tags: ["hexagon", "hex grid", "board", "six neighbors", "adjacency"],
    families: ["grid"],
    usage: mechanics("hex"),
    source: "mechanics/hex.ts",
    status: "ready",
  },
  {
    id: "mech:connection",
    kind: "mechanic",
    title: "Connection win condition",
    description:
      "Win by building an unbroken chain of your pieces that links two opposite sides of the board, checked with a breadth-first search over neighbors.",
    tags: ["connect", "path", "chain", "link sides", "bridge", "network"],
    families: ["grid"],
    usage: mechanics("connection"),
    source: "mechanics/connection.ts",
    status: "ready",
  },

  // Race mechanics
  {
    id: "mech:dice",
    kind: "mechanic",
    title: "Dice rolling",
    description:
      "Roll one or more dice with the seeded rng, count dice showing a face (with wild faces), and compute the binomial odds that at least k dice match. Chance, luck and push-your-luck.",
    tags: ["dice", "roll", "luck", "chance", "random", "probability", "odds"],
    families: ["race", "bluff"],
    usage: mechanics("dice"),
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
    usage: mechanics("track"),
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
    id: "mech:shortcuts",
    kind: "mechanic",
    title: "Ladders and snakes",
    description:
      "Landing on certain squares jumps you forward (ladders, shortcuts) or back (snakes, chutes, traps); overshooting the final square bounces you back.",
    tags: ["ladder", "snake", "shortcut", "trap", "jump", "bounce", "exact finish"],
    families: ["race"],
    usage: mechanics("shortcuts"),
    source: "mechanics/shortcuts.ts",
    status: "ready",
  },

  // Bluff mechanics
  {
    id: "mech:bidding",
    kind: "mechanic",
    title: "Escalating bids and challenges",
    description:
      "Players make ever-higher claims about hidden information; the next player raises the bid or calls liar, and the loser of the challenge is penalized.",
    tags: ["bid", "bluff", "claim", "challenge", "call liar", "raise"],
    families: ["bluff"],
    usage: mechanics("bidding"),
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
    id: "mech:face-down-claims",
    kind: "mechanic",
    title: "Face-down claims and doubt",
    description:
      "Play cards face down while announcing what they are; the next player accepts or doubts, and the pile goes to whoever was wrong.",
    tags: ["bluff", "claim", "doubt", "cheat", "face down", "lie", "pile"],
    families: ["bluff"],
    usage: "see applyMove in I Doubt It",
    source: "games/i-doubt-it.ts",
    status: "ready",
  },
  {
    id: "mech:hidden-roles",
    kind: "mechanic",
    title: "Hidden roles",
    description:
      "Secretly deal roles or teams; each player sees only their own role, and some roles know their teammates. Social deduction, traitors, werewolves, spies.",
    tags: ["hidden role", "secret team", "social deduction", "traitor", "werewolf", "spy"],
    families: ["bluff"],
    usage: mechanics("roles"),
    source: "mechanics/roles.ts",
    status: "ready",
  },
  {
    id: "mech:voting",
    kind: "mechanic",
    title: "Voting and elimination",
    description:
      "Players vote on a target; tally the ballots, find the most-voted or a strict majority, and eliminate or exile them. Ties and abstentions handled.",
    tags: ["vote", "elimination", "majority", "exile", "ballot", "plurality"],
    families: ["bluff"],
    usage: mechanics("voting"),
    source: "mechanics/voting.ts",
    status: "ready",
  },

  // General mechanics
  {
    id: "mech:deck",
    kind: "mechanic",
    title: "Deck, hands and discard",
    description:
      "Build a deck of cards, shuffle with the seeded rng, deal hands round-robin, draw cards and reshuffle the discard pile when the draw pile runs out.",
    tags: ["cards", "deck", "shuffle", "deal", "draw", "hand", "discard"],
    families: ["bluff"],
    usage: mechanics("deck"),
    source: "mechanics/deck.ts",
    status: "ready",
  },
  {
    id: "mech:turn-order",
    kind: "mechanic",
    title: "Turn order",
    description:
      "Pass the turn around the table clockwise or counterclockwise, skipping players who are out; start a round from any seat.",
    tags: ["turn order", "next player", "clockwise", "reverse direction", "skip eliminated"],
    families: ["grid", "race", "bluff"],
    usage: mechanics("turns"),
    source: "mechanics/turns.ts",
    status: "ready",
  },
  {
    id: "mech:scoring",
    kind: "mechanic",
    title: "Scoring, end conditions and ties",
    description:
      "Decide who wins at the end: highest score, first to reach a target, or furthest along when a round limit runs out; ties share the win and a full tie is a draw.",
    tags: ["score", "points", "victory points", "target score", "round limit", "tiebreak", "draw"],
    families: ["grid", "race", "bluff"],
    usage: mechanics("scoring"),
    source: "mechanics/scoring.ts",
    status: "ready",
  },

  // Economy and map mechanics
  {
    id: "mech:resources",
    kind: "mechanic",
    title: "Resource pools and costs",
    description:
      "Count resources as plain objects, check whether a player can afford a cost, pay it, gain income and see what is still missing. Wood, brick, coins, gems, energy: any named goods.",
    tags: ["resources", "cost", "pay", "afford", "income", "economy", "goods"],
    families: ["engine", "map"],
    usage: mechanics("resources"),
    source: "mechanics/resources.ts",
    status: "ready",
  },
  {
    id: "mech:market",
    kind: "mechanic",
    title: "Card market row",
    description:
      "A face-up row of cards that players buy or take from; the row refills from the draw pile after each pick, reshuffling the discards, and players may also draw blind.",
    tags: ["market", "card row", "buy", "shop", "river", "refill", "face up"],
    families: ["engine"],
    usage: mechanics("market"),
    source: "mechanics/market.ts",
    status: "ready",
  },
  {
    id: "mech:effects",
    kind: "mechanic",
    title: "Card effect language",
    description:
      "Cards as data: cost, points, tags and effects that trigger when played, at every harvest or income phase, and at game end. Gain resources, draw cards, score points, convert one resource into another, or earn per tagged card in your tableau. Rules text is generated from the data.",
    tags: ["card effects", "engine building", "combo", "tableau", "income", "end game bonus", "tags"],
    families: ["engine"],
    usage: mechanics("effects"),
    source: "mechanics/effects.ts",
    status: "ready",
  },
  {
    id: "mech:hex-map",
    kind: "mechanic",
    title: "Hex map corners and edges",
    description:
      "Build on a map of hexagonal tiles: settlements on the corners where tiles meet, roads along the edges between corners. The distance rule keeps settlements apart, roads must connect to your network and stop at rival buildings, and settlements upgrade to cities.",
    tags: ["hex map", "settlements", "roads", "vertices", "edges", "corners", "building", "island"],
    families: ["map"],
    usage: mechanics("hexmap"),
    source: "mechanics/hexmap.ts",
    status: "ready",
  },
  {
    id: "mech:production",
    kind: "mechanic",
    title: "Tile production",
    description:
      "Tiles produce resources for the buildings on their corners, with bigger buildings collecting more. A dice roll, an event deck or a season decides which tiles produce; event decks reshuffle when they run out.",
    tags: ["production", "harvest", "yield", "income", "event deck", "dice roll", "resources"],
    families: ["map", "engine"],
    usage: mechanics("production"),
    source: "mechanics/production.ts",
    status: "ready",
  },
  {
    id: "mech:trading",
    kind: "mechanic",
    title: "Trading: bank and player offers",
    description:
      "Trade resources at a fixed rate with the bank, such as three or four of one kind for any one, or offer another player a swap that they accept or decline; a pending offer passes the decision to them.",
    tags: ["trade", "negotiation", "deal", "resources", "bank", "exchange", "offer"],
    families: ["map"],
    usage: mechanics("trade"),
    source: "mechanics/trade.ts",
    status: "ready",
  },

  {
    id: "mech:worker-placement",
    kind: "mechanic",
    title: "Worker placement",
    description: "Take turns sending workers to action spaces; an occupied space is blocked for everyone else this round.",
    tags: ["workers", "action spaces", "blocking", "resources", "euro"],
    families: [],
    usage: mechanics("workers"),
    source: "mechanics/workers.ts",
    status: "ready",
  },
  {
    id: "mech:area-control",
    kind: "mechanic",
    title: "Area control",
    description: "Players place or move units into regions; whoever has the majority in a region controls it and scores it at the end.",
    tags: ["territory", "majority", "regions", "control", "influence"],
    families: ["grid"],
    usage: mechanics("majority"),
    source: "mechanics/majority.ts",
    status: "ready",
  },

  // Reference games
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
    id: "game:reversi",
    kind: "game",
    title: "Reversi",
    description:
      "Two players place discs on a square board, flipping rival lines they trap between their own discs; a player with no flipping move passes and the most discs wins.",
    tags: ["abstract", "perfect information", "flip", "flanking", "two player", "territory"],
    families: ["grid"],
    source: "games/reversi.ts",
    status: "ready",
  },
  {
    id: "game:hex",
    kind: "game",
    title: "Hex",
    description:
      "Two players claim hexagons on a rhombus board, one linking top to bottom and the other left to right; someone always connects, and a swap rule balances the first move.",
    tags: ["abstract", "connection", "hexagon", "two player", "no draws", "swap rule", "pie rule"],
    families: ["grid"],
    source: "games/hex.ts",
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
    id: "game:snakes-ladders",
    kind: "game",
    title: "Snakes and Ladders",
    description:
      "Race up a numbered board by rolling two dice and moving by either one; ladders carry you up, snakes drag you down, and you must land exactly on the last square.",
    tags: ["race", "dice", "ladders", "snakes", "roll and move", "luck", "family game"],
    families: ["race"],
    source: "games/snakes-ladders.ts",
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
    id: "game:i-doubt-it",
    kind: "game",
    title: "I Doubt It",
    description:
      "Players play cards face down claiming the rank whose turn it is; the next player accepts or doubts, and whoever was wrong picks up the pile. First to empty their hand wins.",
    tags: ["bluff", "cards", "cheat", "claim", "doubt", "shedding", "hidden hand"],
    families: ["bluff"],
    source: "games/i-doubt-it.ts",
    status: "ready",
  },
  {
    id: "game:glasshouse",
    kind: "game",
    title: "Glasshouse (engine builder)",
    description:
      "Original engine-building card game: gather water, light and soil, take plant cards from a market row, plant them by paying their costs, and harvest to trigger every plant's income. Plants chain bonuses by tag; the highest score after the last turn wins.",
    tags: ["engine building", "tableau", "cards", "market", "resources", "combo", "set bonus"],
    families: ["engine"],
    source: "games/glasshouse.ts",
    status: "ready",
  },
  {
    id: "game:lantern-isles",
    kind: "game",
    title: "Lantern Isles (settle and trade)",
    description:
      "Original hex-map settlement game: place villages on the corners of island tiles and roads along their edges, while a shuffled tide deck decides which terrain produces wood, stone, grain or fish. Trade with the bank or other players, upgrade villages to towns and light lanterns on lagoons; first to ten points wins.",
    tags: ["hex map", "settlement", "trading", "roads", "production", "resources", "victory points"],
    families: ["map"],
    source: "games/lantern-isles.ts",
    status: "ready",
  },
  {
    id: "game:highsail",
    kind: "game",
    title: "Highsail (worker placement and majorities)",
    description:
      "Original worker-placement game: send airship crews to action spaces on a skyport, where a taken space is blocked, to gather timber, crystal, fuel and coins. Take charters from an office row and launch them for points, income every round or end-game bonuses; each launch and each surveyed outpost adds to the majorities on five sky islands, which score after the middle and last rounds.",
    tags: ["worker placement", "area majority", "contracts", "charters", "engine building", "outposts", "euro"],
    families: ["engine"],
    source: "games/highsail.ts",
    status: "ready",
  },

  // Planned mechanics: no code yet, kept as realistic near-misses for retrieval evaluation
  {
    id: "mech:jump-capture",
    kind: "mechanic",
    title: "Jump capture",
    description: "Capture by jumping over an adjacent enemy piece into the empty square beyond; chained multi-jumps, forced captures.",
    tags: ["jump", "capture", "checkers", "draughts", "multi-jump"],
    families: ["grid"],
    status: "planned",
  },
  {
    id: "mech:tile-placement",
    kind: "mechanic",
    title: "Tile placement",
    description: "Draw a tile and place it adjacent to existing tiles so edges match, building a shared map that scores features.",
    tags: ["tiles", "map building", "edge matching", "placement", "landscape"],
    families: ["grid"],
    status: "planned",
  },
  {
    id: "mech:push-your-luck",
    kind: "mechanic",
    title: "Push your luck",
    description: "Keep rolling or drawing to build up points this turn, but one bad result busts and loses them all; stop any time to bank.",
    tags: ["push your luck", "bank", "bust", "risk", "press on"],
    families: ["race"],
    status: "planned",
  },
  {
    id: "mech:open-auction",
    kind: "mechanic",
    title: "Open auction",
    description: "Players bid money openly for an item; the highest bidder pays and takes it. English auction, once-around, sealed bids.",
    tags: ["auction", "bid", "money", "economic", "highest bidder"],
    families: [],
    status: "planned",
  },
  {
    id: "mech:set-collection",
    kind: "mechanic",
    title: "Set collection",
    description: "Gather matching cards or tokens into sets; larger or rarer sets score more points.",
    tags: ["sets", "collect", "matching", "combos", "scoring"],
    families: [],
    status: "planned",
  },
  {
    id: "mech:trick-taking",
    kind: "mechanic",
    title: "Trick-taking",
    description: "Each player plays one card to a trick, following the led suit if they can; the highest card or trump wins the trick.",
    tags: ["tricks", "follow suit", "trump", "card play", "lead"],
    families: [],
    status: "planned",
  },
  {
    id: "mech:card-drafting",
    kind: "mechanic",
    title: "Card drafting",
    description: "Pick one card from a hand and pass the rest to your neighbor until all cards are taken.",
    tags: ["draft", "pick and pass", "cards", "hand"],
    families: [],
    status: "planned",
  },
  {
    id: "mech:memory",
    kind: "mechanic",
    title: "Memory matching",
    description: "Cards lie face down; flip two per turn and keep them if they match, otherwise turn them back over.",
    tags: ["memory", "concentration", "pairs", "flip", "matching"],
    families: [],
    status: "planned",
  },
  {
    id: "mech:simultaneous-selection",
    kind: "mechanic",
    title: "Simultaneous action selection",
    description: "Everyone secretly picks an action at the same time, then all are revealed and resolved together, as in rock-paper-scissors.",
    tags: ["simultaneous", "secret choice", "reveal", "outguess", "rock paper scissors"],
    families: ["bluff"],
    status: "planned",
  },
  {
    id: "mech:deduction",
    kind: "mechanic",
    title: "Code-breaking deduction",
    description: "Guess a hidden code and get feedback on how close the guess is; narrow it down by logic before running out of guesses.",
    tags: ["deduction", "code", "guess", "feedback", "logic", "mastermind"],
    families: [],
    status: "planned",
  },
  {
    id: "mech:cooperative-threat",
    kind: "mechanic",
    title: "Shared threat (cooperative)",
    description: "All players win or lose together against the game itself: an event deck escalates a threat each round until they complete the goal or run out of time.",
    tags: ["cooperative", "team", "shared loss", "event deck", "escalation"],
    families: [],
    status: "planned",
  },
];
