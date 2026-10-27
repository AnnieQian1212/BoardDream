import type { GameModule, GeometryPiece, PlayerId } from "@boarddream/engine";
import * as connection from "../mechanics/connection";
import * as hex from "../mechanics/hex";

type HexParams = { size: number; swapRule: boolean };

interface HexState {
  size: number;
  swapRule: boolean;
  cells: (PlayerId | null)[];
  toMove: PlayerId;
  /** Moves made so far, swaps included. */
  moves: number;
  winner: PlayerId | null;
}

/** Index of the cell to claim, or SWAP to take over the opening stone. */
type HexMove = number;
const SWAP = -1;

const RADIUS = 0.5;

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Seat 0 links the top row to the bottom row; seat 1 links the left column to the right one. */
function linked(size: number, cells: readonly (PlayerId | null)[], player: PlayerId): boolean {
  const starts = range(size).map((i) => (player === 0 ? hex.hexIndex(size, i, 0) : hex.hexIndex(size, 0, i)));
  const isGoal = (index: number) => {
    const { q, r } = hex.hexCoords(size, index);
    return player === 0 ? r === size - 1 : q === size - 1;
  };
  return connection.connects(starts, isGoal, (index) => cells[index] === player, (index) => hex.hexNeighbors(size, index));
}

/**
 * Hex: players claim cells on a rhombus of hexagons, each trying to link their two sides. The board
 * can never fill without someone connecting, so there are no draws. With the swap rule, the second
 * player may take over the opening stone, which offsets the first-move advantage.
 */
export const hexGame: GameModule<HexState, HexMove, HexParams> = {
  meta: {
    id: "hex",
    name: "Hex",
    family: "grid",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 2,
    summary: "Claim hexagons to link your two sides of the board; someone always connects.",
  },
  params: [
    { key: "size", label: "Board size", kind: "int", min: 4, max: 11, default: 7 },
    { key: "swapRule", label: "Second player may swap the opening stone", kind: "bool", default: true },
  ],

  setup: ({ params }) => ({
    size: params.size,
    swapRule: params.swapRule,
    cells: new Array(params.size * params.size).fill(null),
    toMove: 0,
    moves: 0,
    winner: null,
  }),

  activePlayers: (s) => (s.winner === null ? [s.toMove] : []),

  legalMoves(s) {
    const empty = s.cells.flatMap((cell, i) => (cell === null ? [i] : []));
    return s.swapRule && s.moves === 1 ? [...empty, SWAP] : empty;
  },

  applyMove(s, player, move) {
    if (move === SWAP) {
      // Mirror the opening stone across the long diagonal so it serves the swapper's direction.
      const { q, r } = hex.hexCoords(s.size, s.cells.findIndex((cell) => cell !== null));
      const cells: (PlayerId | null)[] = new Array(s.cells.length).fill(null);
      cells[hex.hexIndex(s.size, r, q)] = player;
      return { ...s, cells, toMove: 1 - player, moves: s.moves + 1 };
    }
    const cells = s.cells.slice();
    cells[move] = player;
    return { ...s, cells, toMove: 1 - player, moves: s.moves + 1, winner: linked(s.size, cells, player) ? player : null };
  },

  isTerminal: (s) => s.winner !== null,

  outcome: (s) => ({ winners: s.winner === null ? [] : [s.winner] }),

  geometry(s) {
    const board = hex.rhombusBoard(s.size, RADIUS);
    // Tint each player's goal edges; corners go to the top/bottom player.
    const cells = board.cells.map((cell, i) => {
      const { q, r } = hex.hexCoords(s.size, i);
      if (r === 0 || r === s.size - 1) return { ...cell, owner: 0 };
      if (q === 0 || q === s.size - 1) return { ...cell, owner: 1 };
      return cell;
    });
    const pieces: GeometryPiece[] = [];
    s.cells.forEach((owner, i) => {
      if (owner === null) return;
      const { q, r } = hex.hexCoords(s.size, i);
      const [x, y] = hex.hexCenter(q, r, RADIUS);
      pieces.push({ id: `p${i}`, x, y, r: RADIUS * 0.6, owner, cellId: hex.hexCellId(q, r) });
    });
    return { width: board.width, height: board.height, cells, pieces };
  },

  moveTarget(s, move) {
    if (move === SWAP) return undefined;
    const { q, r } = hex.hexCoords(s.size, move);
    return hex.hexCellId(q, r);
  },

  describeMove(s, move) {
    if (move === SWAP) return "swap: take over the opening stone";
    const { q, r } = hex.hexCoords(s.size, move);
    return `claim (${q + 1}, ${r + 1})`;
  },
};
