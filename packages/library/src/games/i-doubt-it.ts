import { rectPolygon, type GameModule, type GeometryCell, type GeometryPiece, type PlayerId } from "@boarddream/engine";
import * as deck from "../mechanics/deck";
import * as scoring from "../mechanics/scoring";
import * as turns from "../mechanics/turns";

type DoubtParams = { ranks: number; maxPlays: number };

/** A face-down play waiting for the next player to accept or doubt it. */
interface Play {
  player: PlayerId;
  rank: number;
  count: number;
  claim: number;
}

interface Reveal {
  player: PlayerId;
  claim: number;
  rank: number;
  count: number;
  taker: PlayerId;
  pile: number;
}

interface DoubtState {
  numPlayers: number;
  ranks: number;
  maxPlays: number;
  hands: number[][];
  pile: number[];
  /** Rank the next play must claim; it climbs by one each turn and wraps around. */
  claim: number;
  lastPlay: Play | null;
  phase: "play" | "respond";
  toMove: PlayerId;
  plays: number;
  lastReveal: Reveal | null;
  winners: PlayerId[] | null;
}

/** Plays put down `count` cards of one real `rank`, always claimed as the required rank. */
type DoubtMove = { type: "play"; rank: number; count: number } | { type: "accept" } | { type: "doubt" };

const RANK_NAMES: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const rankName = (rank: number) => RANK_NAMES[rank] ?? String(rank);
const plural = (count: number) => (count === 1 ? "" : "s");

/** Next turn after a play is settled; past the play limit, fewest cards wins. */
function nextTurn(s: DoubtState, hands: number[][], responder: PlayerId, extra: Partial<DoubtState>): DoubtState {
  const settled = { ...s, ...extra, hands, lastPlay: null, phase: "play" as const, toMove: responder, claim: (s.claim % s.ranks) + 1 };
  return s.plays >= s.maxPlays ? { ...settled, winners: scoring.scoreWinners(hands.map((hand) => -hand.length)) } : settled;
}

/**
 * I Doubt It: players take turns putting cards face down, claiming they are the rank whose turn it is.
 * The next player accepts or doubts. A doubted lie sends the whole pile to the liar; a doubted truth
 * sends it to the doubter. Empty your hand without being caught to win.
 */
export const iDoubtIt: GameModule<DoubtState, DoubtMove, DoubtParams> = {
  meta: {
    id: "i-doubt-it",
    name: "I Doubt It",
    family: "bluff",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 6,
    summary: "Play cards face down claiming the rank in turn; the next player accepts or doubts. Empty your hand to win.",
  },
  params: [
    { key: "ranks", label: "Ranks in the deck", kind: "int", min: 6, max: 13, default: 13 },
    { key: "maxPlays", label: "Play limit", kind: "int", min: 60, max: 300, step: 30, default: 180 },
  ],

  setup: ({ numPlayers, params, rng }) => ({
    numPlayers,
    ranks: params.ranks,
    maxPlays: params.maxPlays,
    hands: deck.deal(rng.shuffle(deck.numberedDeck(params.ranks, 4)), numPlayers).hands.map((hand) => hand.sort((a, b) => a - b)),
    pile: [],
    claim: 1,
    lastPlay: null,
    phase: "play",
    toMove: 0,
    plays: 0,
    lastReveal: null,
    winners: null,
  }),

  activePlayers: (s) => (s.winners !== null ? [] : [s.toMove]),

  legalMoves(s, player) {
    if (s.phase === "respond") return [{ type: "accept" }, { type: "doubt" }];
    const moves: DoubtMove[] = [];
    for (const [rank, held] of deck.countByValue(s.hands[player])) {
      for (let count = 1; count <= Math.min(3, held); count++) moves.push({ type: "play", rank, count });
    }
    return moves;
  },

  applyMove(s, player, move) {
    if (move.type === "play") {
      const hands = s.hands.map((hand, p) => (p === player ? deck.removeCards(hand, move.rank, move.count) : hand));
      return {
        ...s,
        hands,
        pile: [...s.pile, ...new Array<number>(move.count).fill(move.rank)],
        lastPlay: { player, rank: move.rank, count: move.count, claim: s.claim },
        phase: "respond",
        toMove: turns.nextSeat(player, s.numPlayers),
        plays: s.plays + 1,
      };
    }
    const play = s.lastPlay!;
    if (move.type === "accept") {
      if (s.hands[play.player].length === 0) return { ...s, lastPlay: null, winners: [play.player] };
      return nextTurn(s, s.hands, player, {});
    }
    const honest = play.rank === play.claim;
    const taker = honest ? player : play.player;
    const hands = s.hands.map((hand, p) => (p === taker ? [...hand, ...s.pile].sort((a, b) => a - b) : hand));
    const lastReveal: Reveal = { player: play.player, claim: play.claim, rank: play.rank, count: play.count, taker, pile: s.pile.length };
    if (honest && hands[play.player].length === 0) return { ...s, hands, pile: [], lastPlay: null, lastReveal, winners: [play.player] };
    return nextTurn(s, hands, player, { pile: [], lastReveal });
  },

  isTerminal: (s) => s.winners !== null,

  outcome: (s) => ({ winners: s.winners ?? [] }),

  view: (s, me) => ({
    me,
    myHand: s.hands[me],
    handCounts: s.hands.map((hand) => hand.length),
    pileCount: s.pile.length,
    claim: s.claim,
    lastPlay: s.lastPlay && {
      player: s.lastPlay.player,
      count: s.lastPlay.count,
      claim: s.lastPlay.claim,
      ...(s.lastPlay.player === me ? { rank: s.lastPlay.rank } : {}),
    },
    phase: s.phase,
    toMove: s.toMove,
    lastReveal: s.lastReveal,
    winners: s.winners,
    ranks: s.ranks,
  }),

  geometry(s, viewer) {
    const me = viewer ?? 0;
    const cells: GeometryCell[] = [];
    const pieces: GeometryPiece[] = [];
    // Rivals sit around the top of the table in turn order; the viewer's hand fans out at the bottom.
    for (let k = 1; k < s.numPlayers; k++) {
      const p = (me + k) % s.numPlayers;
      const angle = Math.PI + (Math.PI * k) / s.numPlayers;
      const cx = 6 + 4.6 * Math.cos(angle);
      const cy = 6 + 4.6 * Math.sin(angle);
      const count = s.hands[p].length;
      cells.push({ id: `seat${p}`, polygon: rectPolygon(cx - 1.4, cy - 0.45, 2.8, 0.9), owner: p, label: `P${p + 1}: ${count} card${plural(count)}` });
    }
    cells.push({
      id: `name${me}`,
      polygon: rectPolygon(2, 8.3, 8, 0.5),
      kind: "label",
      label: `P${me + 1}${viewer === undefined ? "" : " (you)"}: ${s.hands[me].length} card${plural(s.hands[me].length)}`,
    });
    s.hands[me].forEach((rank, i) => {
      const row = Math.floor(i / 13);
      const col = i % 13;
      const inRow = Math.min(13, s.hands[me].length - row * 13);
      pieces.push({ id: `c${i}`, x: 6 + (col - (inRow - 1) / 2) * 0.62, y: 9.2 + row * 0.62, r: 0.27, owner: me, shape: "square", label: rankName(rank) });
    });

    const play = s.lastPlay;
    const center = play
      ? `P${play.player + 1} claims ${play.count} × ${rankName(play.claim)}`
      : `Next claim: ${rankName(s.claim)}s`;
    cells.push({ id: "pile", polygon: rectPolygon(2, 4.7, 8, 0.6), kind: "label", label: `Pile: ${s.pile.length} card${plural(s.pile.length)}` });
    cells.push({ id: "claim", polygon: rectPolygon(2, 5.4, 8, 0.6), kind: "label", label: center });
    if (s.lastReveal) {
      const r = s.lastReveal;
      const truth = r.rank === r.claim ? "true" : `really ${rankName(r.rank)}`;
      cells.push({
        id: "reveal",
        polygon: rectPolygon(2, 6.2, 8, 0.6),
        kind: "label",
        label: `Doubted ${r.count} × ${rankName(r.claim)}: ${truth}, P${r.taker + 1} takes ${r.pile}`,
      });
    }
    return { width: 12, height: 12, cells, pieces };
  },

  describeMove(s, move, viewer) {
    if (move.type === "play") {
      const claimed = `${move.count} card${plural(move.count)} as ${rankName(s.claim)}`;
      // Only the mover (or an omniscient log) sees which cards really went down.
      return viewer === undefined || viewer === s.toMove ? `play ${move.count} × ${rankName(move.rank)} as ${rankName(s.claim)}` : `play ${claimed}`;
    }
    const play = s.lastPlay;
    const what = play ? ` P${play.player + 1}'s ${play.count} × ${rankName(play.claim)}` : "";
    return `${move.type}${what}`;
  },
};
