import { regularPolygon, type GameModule, type GeometryPiece, type PlayerId } from "@boarddream/engine";
import * as dice from "../mechanics/dice";
import * as track from "../mechanics/track";

type RaceParams = { trackLength: number; pawns: number; sixToEnter: boolean; maxRounds: number };

/** Pawn progress: BASE before entering, 0..trackLength-1 on the track, trackLength once home. */
const BASE = -1;

interface RaceState {
  trackLength: number;
  sixToEnter: boolean;
  maxRounds: number;
  numPlayers: number;
  starts: number[];
  pawns: number[][];
  toMove: PlayerId;
  /** Die showing for the current turn; null until the player rolls. */
  roll: number | null;
  round: number;
  winners: PlayerId[] | null;
}

type RaceMove = { type: "roll" } | { type: "advance"; pawn: number } | { type: "pass" };

const RING: track.Ring = { cx: 6, cy: 6, inner: 4.4, outer: 5.6 };

const destination = (s: RaceState, progress: number) =>
  progress === BASE ? 0 : Math.min(progress + (s.roll ?? 0), s.trackLength);

const squareOf = (s: RaceState, player: PlayerId, progress: number) =>
  track.loopSquare(s.starts[player], progress, s.trackLength);

const progressTotal = (s: RaceState, player: PlayerId) => s.pawns[player].reduce((sum, p) => sum + Math.max(p, 0), 0);

/** Players furthest along when the round limit hits; ties share the win. */
function leaders(s: RaceState): PlayerId[] {
  const totals = s.pawns.map((_, p) => progressTotal(s, p));
  const best = Math.max(...totals);
  return totals.flatMap((total, p) => (total === best ? [p] : []));
}

/**
 * Pachisi-style race: roll a die, move a pawn once around the loop and into home. Landing on a
 * rival's pawn sends it back to base, except on start squares, which are safe. A six earns another
 * roll. A round limit guarantees the game ends.
 */
export const raceHome: GameModule<RaceState, RaceMove, RaceParams> = {
  meta: {
    id: "race-home",
    name: "Race Home",
    family: "race",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 4,
    summary: "Roll and race your pawns once around the track; landing on a rival sends it back to base.",
  },
  params: [
    { key: "trackLength", label: "Track length", kind: "int", min: 16, max: 48, step: 4, default: 28 },
    { key: "pawns", label: "Pawns per player", kind: "int", min: 1, max: 4, default: 2 },
    { key: "sixToEnter", label: "Need a 6 to enter", kind: "bool", default: true },
    { key: "maxRounds", label: "Round limit", kind: "int", min: 20, max: 120, step: 10, default: 80 },
  ],

  setup: ({ numPlayers, params }) => ({
    trackLength: params.trackLength,
    sixToEnter: params.sixToEnter,
    maxRounds: params.maxRounds,
    numPlayers,
    starts: track.startSquares(numPlayers, params.trackLength),
    pawns: Array.from({ length: numPlayers }, () => new Array(params.pawns).fill(BASE)),
    toMove: 0,
    roll: null,
    round: 0,
    winners: null,
  }),

  activePlayers: (s) => (s.winners ? [] : [s.toMove]),

  legalMoves(s, player) {
    if (s.roll === null) return [{ type: "roll" }];
    const moves: RaceMove[] = [];
    const seen = new Set<number>();
    s.pawns[player].forEach((progress, pawn) => {
      // Pawns that are home, or that share a spot with an earlier pawn, add no new choice.
      if (progress === s.trackLength || seen.has(progress)) return;
      if (progress === BASE && s.sixToEnter && s.roll !== 6) return;
      seen.add(progress);
      moves.push({ type: "advance", pawn });
    });
    return moves.length > 0 ? moves : [{ type: "pass" }];
  },

  applyMove(s, player, move, rng) {
    if (move.type === "roll") return { ...s, roll: dice.roll(rng) };

    let pawns = s.pawns;
    if (move.type === "advance") {
      const to = destination(s, s.pawns[player][move.pawn]);
      pawns = s.pawns.map((row, p) => (p === player ? row.map((x, i) => (i === move.pawn ? to : x)) : row));
      const square = squareOf(s, player, to);
      if (to < s.trackLength && !s.starts.includes(square)) {
        pawns = pawns.map((row, p) =>
          p === player ? row : row.map((x) => (x >= 0 && x < s.trackLength && squareOf(s, p, x) === square ? BASE : x)),
        );
      }
      if (pawns[player].every((x) => x === s.trackLength)) return { ...s, pawns, roll: null, winners: [player] };
    }

    if (s.roll === 6) return { ...s, pawns, roll: null };
    const next = (player + 1) % s.numPlayers;
    const round = next === 0 ? s.round + 1 : s.round;
    const passed = { ...s, pawns, toMove: next, roll: null, round };
    return round >= s.maxRounds ? { ...passed, winners: leaders(passed) } : passed;
  },

  isTerminal: (s) => s.winners !== null,

  outcome: (s) => ({ winners: s.winners ?? [], scores: s.pawns.map((_, p) => progressTotal(s, p)) }),

  geometry(s) {
    const cells = track.ringCells(RING, s.trackLength).map((cell, square) => {
      const owner = s.starts.indexOf(square);
      return owner >= 0 ? { ...cell, owner, kind: "start" } : cell;
    });
    cells.push({ id: "home", polygon: regularPolygon(RING.cx, RING.cy, 1.6, 8), label: "Home" });

    const pieces: GeometryPiece[] = [];
    const stacked = new Map<number, number>();
    const totalPawns = s.numPlayers * s.pawns[0].length;
    s.pawns.forEach((row, p) =>
      row.forEach((progress, i) => {
        const id = `p${p}-${i}`;
        let point: [number, number];
        if (progress === BASE) {
          // Waiting pawns line up toward the center, behind their start square.
          point = track.ringPoint(RING, s.trackLength, s.starts[p] + 0.5, 3.8 - 0.5 * i);
        } else if (progress === s.trackLength) {
          const slot = p * row.length + i;
          const angle = (2 * Math.PI * slot) / totalPawns;
          point = [RING.cx + 0.9 * Math.cos(angle), RING.cy + 0.9 * Math.sin(angle)];
        } else {
          const square = squareOf(s, p, progress);
          const depth = stacked.get(square) ?? 0;
          stacked.set(square, depth + 1);
          point = track.ringPoint(RING, s.trackLength, square + 0.5, 4.75 + 0.3 * (depth % 3));
        }
        pieces.push({ id, x: point[0], y: point[1], r: 0.2, owner: p });
      }),
    );
    return { width: 12, height: 12, cells, pieces };
  },

  moveTarget(s, move) {
    if (move.type !== "advance") return undefined;
    const to = destination(s, s.pawns[s.toMove][move.pawn]);
    return to < s.trackLength ? track.squareId(squareOf(s, s.toMove, to)) : undefined;
  },

  describeMove(s, move) {
    if (move.type === "roll") return "roll the die";
    if (move.type === "pass") return `pass (rolled ${s.roll}, no legal move)`;
    const from = s.pawns[s.toMove][move.pawn];
    const pawn = `pawn ${move.pawn + 1}`;
    if (from === BASE) return `enter ${pawn} (rolled ${s.roll})`;
    return destination(s, from) === s.trackLength ? `${pawn} reaches home (rolled ${s.roll})` : `move ${pawn} ${s.roll} squares`;
  },
};
