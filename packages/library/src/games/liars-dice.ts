import { rectPolygon, type GameModule, type GeometryCell, type GeometryPiece, type PlayerId } from "@boarddream/engine";
import * as bidding from "../mechanics/bidding";
import * as dice from "../mechanics/dice";
import * as turns from "../mechanics/turns";

type LiarsDiceParams = { startDice: number; wildOnes: boolean };

/** Public record of the last challenge, shown until the next one. */
export interface Reveal {
  bidder: PlayerId;
  challenger: PlayerId;
  bid: bidding.Bid;
  count: number;
  loser: PlayerId;
  dice: number[][];
}

interface LiarsDiceState {
  numPlayers: number;
  wildOnes: boolean;
  /** Every player's hidden dice; an empty row means the player is out. */
  dice: number[][];
  bid: bidding.Bid | null;
  bidder: PlayerId | null;
  toMove: PlayerId;
  lastReveal: Reveal | null;
  winner: PlayerId | null;
}

/** What one player knows: their own dice, how many dice everyone has, and the public bidding. */
export interface LiarsDiceView {
  me: PlayerId;
  myDice: number[];
  diceCounts: number[];
  wildOnes: boolean;
  bid: bidding.Bid | null;
  bidder: PlayerId | null;
  toMove: PlayerId;
  lastReveal: Reveal | null;
  winner: PlayerId | null;
}

export type LiarsDiceMove = { type: "bid"; quantity: number; face: number } | { type: "liar" };

/** With wild ones, ones count toward every bid and cannot be bid themselves. */
const biddableFaces = (s: { wildOnes: boolean }) => (s.wildOnes ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6]);

const totalDice = (rows: number[][]) => rows.reduce((n, row) => n + row.length, 0);

const nextInPlay = (rows: number[][], from: PlayerId) => turns.nextSeat(from, rows.length, (seat) => rows[seat].length > 0);

const bidText = (bid: bidding.Bid) => `${bid.quantity} × ${bid.face}s`;

/**
 * Liar's dice: everyone rolls dice in secret, then players take turns raising a claim about how many
 * dice on the whole table show a face, or calling "liar" on the last claim. The dice are revealed;
 * whoever was wrong loses a die. The last player with dice wins.
 */
export const liarsDice: GameModule<LiarsDiceState, LiarsDiceMove, LiarsDiceParams> = {
  meta: {
    id: "liars-dice",
    name: "Liar's Dice",
    family: "bluff",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 6,
    rules: [
      "Everyone rolls their dice in secret.",
      "On your turn, raise the bid (more dice, or the same count of a higher face) about how many dice of a face are on the whole table, or call liar on the last bid.",
      "On a call all dice are revealed: if the bid was true the caller loses a die, otherwise the bidder does.",
      "The last player with dice wins.",
    ],
    summary: "Bid on hidden dice across the table or call liar; whoever is wrong loses a die.",
  },
  params: [
    { key: "startDice", label: "Dice per player", kind: "int", min: 2, max: 6, default: 5 },
    { key: "wildOnes", label: "Ones are wild", kind: "bool", default: true },
  ],

  setup: ({ numPlayers, params, rng }) => ({
    numPlayers,
    wildOnes: params.wildOnes,
    dice: Array.from({ length: numPlayers }, () => dice.rollMany(rng, params.startDice)),
    bid: null,
    bidder: null,
    toMove: 0,
    lastReveal: null,
    winner: null,
  }),

  activePlayers: (s) => (s.winner === null ? [s.toMove] : []),

  legalMoves(s) {
    const raises = bidding.raisesAbove(s.bid, { maxQuantity: totalDice(s.dice), faces: biddableFaces(s) });
    const moves: LiarsDiceMove[] = raises.map((bid) => ({ type: "bid", ...bid }));
    if (s.bid) moves.push({ type: "liar" });
    return moves;
  },

  applyMove(s, player, move, rng) {
    if (move.type === "bid") {
      return { ...s, bid: { quantity: move.quantity, face: move.face }, bidder: player, toMove: nextInPlay(s.dice, player) };
    }
    // Challenge: reveal, the wrong side loses a die, and survivors reroll for the next round.
    const bid = s.bid!;
    const bidder = s.bidder!;
    const wild = s.wildOnes ? 1 : undefined;
    const count = s.dice.reduce((n, row) => n + dice.countFace(row, bid.face, wild), 0);
    const loser = count >= bid.quantity ? player : bidder;
    const kept = s.dice.map((row, p) => (p === loser ? row.slice(1) : row));
    const lastReveal: Reveal = { bidder, challenger: player, bid, count, loser, dice: s.dice };
    const inPlay = kept.filter((row) => row.length > 0).length;
    if (inPlay === 1) {
      return { ...s, dice: kept, bid: null, bidder: null, lastReveal, winner: kept.findIndex((row) => row.length > 0) };
    }
    return {
      ...s,
      dice: kept.map((row) => dice.rollMany(rng, row.length)),
      bid: null,
      bidder: null,
      lastReveal,
      toMove: kept[loser].length > 0 ? loser : nextInPlay(kept, loser),
    };
  },

  isTerminal: (s) => s.winner !== null,

  outcome: (s) => ({ winners: s.winner === null ? [] : [s.winner] }),

  view: (s, me): LiarsDiceView => ({
    me,
    myDice: s.dice[me],
    diceCounts: s.dice.map((row) => row.length),
    wildOnes: s.wildOnes,
    bid: s.bid,
    bidder: s.bidder,
    toMove: s.toMove,
    lastReveal: s.lastReveal,
    winner: s.winner,
  }),

  geometry(s, viewer) {
    const cells: GeometryCell[] = [];
    const pieces: GeometryPiece[] = [];
    const bottom = viewer ?? 0;
    s.dice.forEach((row, p) => {
      // Seats around the table, with the viewer at the bottom.
      const angle = Math.PI / 2 + (2 * Math.PI * (p - bottom)) / s.numPlayers;
      const cx = 6 + 4.2 * Math.cos(angle);
      const cy = 6 + 4.2 * Math.sin(angle);
      cells.push({ id: `seat${p}`, polygon: rectPolygon(cx - 1.9, cy - 0.55, 3.8, 1.1), owner: p });
      cells.push({
        id: `name${p}`,
        polygon: rectPolygon(cx - 1.9, cy - 1.05, 3.8, 0.45),
        kind: "label",
        label: `P${p + 1}${p === viewer ? " (you)" : ""}${row.length === 0 ? ": out" : ""}`,
      });
      const visible = viewer === undefined || viewer === p || s.winner !== null;
      row.forEach((face, i) => {
        pieces.push({
          id: `d${p}-${i}`,
          x: cx + (i - (row.length - 1) / 2) * 0.6,
          y: cy,
          r: 0.25,
          owner: p,
          shape: "square",
          label: visible ? String(face) : "?",
        });
      });
    });
    // Center text sits between the side seats of a 4-6 player table.
    const bidLine = s.bid ? `Bid: ${bidText(s.bid)} by P${s.bidder! + 1}` : "No bid yet";
    cells.push({ id: "bid", polygon: rectPolygon(3.5, 4.5, 5, 0.6), kind: "label", label: bidLine });
    if (s.lastReveal) {
      const r = s.lastReveal;
      cells.push({
        id: "reveal",
        polygon: rectPolygon(3, 6.9, 6, 0.6),
        kind: "label",
        label: `Called ${bidText(r.bid)}: ${r.count} found, P${r.loser + 1} -1 die`,
      });
    }
    return { width: 12, height: 12, cells, pieces };
  },

  describeMove(s, move) {
    return move.type === "bid" ? `bid ${bidText(move)}` : `call liar on ${s.bid ? bidText(s.bid) : "nothing"}`;
  },
};
