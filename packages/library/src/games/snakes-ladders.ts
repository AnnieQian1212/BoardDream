import { rectPolygon, type GameModule, type GeometryCell, type GeometryPiece, type PlayerId } from "@boarddream/engine";
import * as dice from "../mechanics/dice";
import * as scoring from "../mechanics/scoring";
import * as shortcuts from "../mechanics/shortcuts";

type SnakesParams = { squares: number; ladders: number; snakes: number; chooseDie: boolean; maxRounds: number };

interface SnakesState {
  squares: number;
  jumps: shortcuts.Jumps;
  chooseDie: boolean;
  maxRounds: number;
  numPlayers: number;
  positions: number[];
  toMove: PlayerId;
  /** Dice showing this turn; null until the player rolls. */
  dice: number[] | null;
  round: number;
  winners: PlayerId[] | null;
}

type SnakesMove = { type: "roll" } | { type: "move"; steps: number };

const COLUMNS = 10;

/** Square after moving: bounce off the last square, then follow any ladder or snake. */
const landing = (s: SnakesState, from: number, steps: number) =>
  shortcuts.applyJumps(shortcuts.bounceMove(from, steps, s.squares - 1), s.jumps);

/** Board position of a square: rows run bottom to top and alternate direction. */
function squareXY(s: SnakesState, square: number): [number, number] {
  const row = Math.floor(square / COLUMNS);
  const col = row % 2 === 0 ? square % COLUMNS : COLUMNS - 1 - (square % COLUMNS);
  return [col, s.squares / COLUMNS - 1 - row];
}

const squareId = (square: number) => `s${square}`;

/**
 * Snakes and ladders with a choice: roll two dice and move by either one, aiming for ladders and
 * dodging snakes. Overshooting the last square bounces back. A round limit ends long games, with
 * the player furthest along winning. Turn off the choice for the classic one-die race.
 */
export const snakesLadders: GameModule<SnakesState, SnakesMove, SnakesParams> = {
  meta: {
    id: "snakes-ladders",
    name: "Snakes and Ladders",
    family: "race",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 4,
    summary: "Roll two dice and move by either; climb ladders, dodge snakes, land exactly on the last square.",
  },
  params: [
    { key: "squares", label: "Squares", kind: "int", min: 30, max: 100, step: 10, default: 60 },
    { key: "ladders", label: "Ladders", kind: "int", min: 0, max: 8, default: 4 },
    { key: "snakes", label: "Snakes", kind: "int", min: 0, max: 8, default: 4 },
    { key: "chooseDie", label: "Roll two dice, move by either", kind: "bool", default: true },
    { key: "maxRounds", label: "Round limit", kind: "int", min: 20, max: 100, step: 10, default: 60 },
  ],

  setup: ({ numPlayers, params, rng }) => ({
    squares: params.squares,
    jumps: shortcuts.generateJumps(rng, params.squares, params.ladders, params.snakes),
    chooseDie: params.chooseDie,
    maxRounds: params.maxRounds,
    numPlayers,
    positions: new Array(numPlayers).fill(0),
    toMove: 0,
    dice: null,
    round: 0,
    winners: null,
  }),

  activePlayers: (s) => (s.winners !== null ? [] : [s.toMove]),

  legalMoves(s) {
    if (s.dice === null) return [{ type: "roll" }];
    return [...new Set(s.dice)].map((steps) => ({ type: "move", steps }));
  },

  applyMove(s, player, move, rng) {
    if (move.type === "roll") return { ...s, dice: s.chooseDie ? dice.rollMany(rng, 2) : [dice.roll(rng)] };
    const to = landing(s, s.positions[player], move.steps);
    const positions = s.positions.map((square, p) => (p === player ? to : square));
    if (to === s.squares - 1) return { ...s, positions, dice: null, winners: [player] };
    const next = (player + 1) % s.numPlayers;
    const round = next === 0 ? s.round + 1 : s.round;
    const passed = { ...s, positions, toMove: next, dice: null, round };
    return round >= s.maxRounds ? { ...passed, winners: scoring.scoreWinners(positions) } : passed;
  },

  isTerminal: (s) => s.winners !== null,

  outcome: (s) => ({ winners: s.winners ?? [], scores: s.positions }),

  geometry(s) {
    const cells: GeometryCell[] = [];
    for (let square = 0; square < s.squares; square++) {
      const [x, y] = squareXY(s, square);
      const jump = s.jumps.find(([from]) => from === square);
      const arrow = jump ? (jump[1] > square ? "↑" : "↓") + (jump[1] + 1) : "";
      cells.push({
        id: squareId(square),
        polygon: rectPolygon(x, y, 1, 1),
        kind: jump ? (jump[1] > square ? "ladder" : "snake") : undefined,
        label: `${square + 1}${arrow}`,
      });
    }
    const pieces: GeometryPiece[] = s.positions.map((square, p) => {
      const [x, y] = squareXY(s, square);
      return { id: `p${p}`, x: x + 0.25 + 0.5 * (p % 2), y: y + 0.25 + 0.5 * Math.floor(p / 2), r: 0.18, owner: p };
    });
    return { width: COLUMNS, height: s.squares / COLUMNS, cells, pieces };
  },

  moveTarget: (s, move) => (move.type === "move" ? squareId(landing(s, s.positions[s.toMove], move.steps)) : undefined),

  describeMove(s, move) {
    if (move.type === "roll") return s.chooseDie ? "roll two dice" : "roll the die";
    const from = s.positions[s.toMove];
    const landed = shortcuts.bounceMove(from, move.steps, s.squares - 1);
    const to = landing(s, from, move.steps);
    const via = to > landed ? " via a ladder" : to < landed ? " via a snake" : "";
    return `move ${move.steps} to ${to + 1}${via}`;
  },
};
