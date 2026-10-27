import { gridCellId, squareGridGeometry, type GameModule, type PlayerId } from "@boarddream/engine";
import * as grid from "../mechanics/grid";

type LineUpParams = { width: number; height: number; k: number; gravity: boolean };

interface LineUpState {
  width: number;
  height: number;
  k: number;
  gravity: boolean;
  numPlayers: number;
  cells: (PlayerId | null)[];
  toMove: PlayerId;
  winner: PlayerId | null;
  filled: number;
}

/** Index of the cell to claim. */
type LineUpMove = number;

/**
 * m,n,k-game: claim cells in turn; the first straight line of k wins. With gravity on, pieces drop
 * to the lowest empty cell of a column. Covers tic-tac-toe, gomoku and drop-in-column games.
 */
export const lineUp: GameModule<LineUpState, LineUpMove, LineUpParams> = {
  meta: {
    id: "line-up",
    name: "Line Up",
    family: "grid",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 4,
    summary: "Take turns claiming cells; the first to make a straight line of k wins.",
  },
  params: [
    { key: "width", label: "Board width", kind: "int", min: 3, max: 15, default: 7 },
    { key: "height", label: "Board height", kind: "int", min: 3, max: 15, default: 6 },
    { key: "k", label: "Line length to win", kind: "int", min: 3, max: 7, default: 4 },
    { key: "gravity", label: "Pieces drop to the bottom", kind: "bool", default: true },
  ],

  setup: ({ numPlayers, params }) => ({
    ...params,
    numPlayers,
    cells: new Array(params.width * params.height).fill(null),
    toMove: 0,
    winner: null,
    filled: 0,
  }),

  activePlayers: (s) => (lineUp.isTerminal(s) ? [] : [s.toMove]),

  legalMoves(s) {
    if (!s.gravity) return s.cells.flatMap((cell, i) => (cell === null ? [i] : []));
    const moves: LineUpMove[] = [];
    for (let x = 0; x < s.width; x++) {
      const target = grid.dropTarget(s, s.cells, x);
      if (target !== undefined) moves.push(target);
    }
    return moves;
  },

  applyMove(s, player, move) {
    const cells = s.cells.slice();
    cells[move] = player;
    const { x, y } = grid.fromIndex(s, move);
    return {
      ...s,
      cells,
      filled: s.filled + 1,
      winner: grid.completesLine(s, cells, x, y, s.k) ? player : null,
      toMove: (player + 1) % s.numPlayers,
    };
  },

  isTerminal: (s) => s.winner !== null || s.filled === s.cells.length,

  outcome: (s) => ({ winners: s.winner === null ? [] : [s.winner] }),

  geometry(s) {
    const geometry = squareGridGeometry(s.width, s.height);
    s.cells.forEach((owner, i) => {
      if (owner === null) return;
      const { x, y } = grid.fromIndex(s, i);
      geometry.pieces.push({ id: `p${i}`, x: x + 0.5, y: y + 0.5, r: 0.38, owner, cellId: gridCellId(x, y) });
    });
    return geometry;
  },

  moveTarget(s, move) {
    const { x, y } = grid.fromIndex(s, move);
    return gridCellId(x, y);
  },

  describeMove(s, move) {
    const { x, y } = grid.fromIndex(s, move);
    return s.gravity ? `drop in column ${x + 1}` : `claim (${x + 1}, ${y + 1})`;
  },
};
