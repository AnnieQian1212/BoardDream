import { gridCellId, squareGridGeometry, type GameModule, type PlayerId } from "@boarddream/engine";
import * as flanking from "../mechanics/flanking";
import * as grid from "../mechanics/grid";
import * as scoring from "../mechanics/scoring";

type ReversiParams = { size: number };

interface ReversiState {
  width: number;
  height: number;
  cells: (PlayerId | null)[];
  toMove: PlayerId;
  /** Consecutive passes; two in a row end the game. */
  passes: number;
}

/** Index of the cell to place on, or PASS when no placement flips anything. */
type ReversiMove = number;
const PASS = -1;

const discCounts = (s: ReversiState) => [0, 1].map((p) => s.cells.filter((c) => c === p).length);

/**
 * Reversi: place a disc so it traps straight lines of rival discs between it and another of your own,
 * and flip them. A player with no flipping placement passes. Most discs when neither can move wins.
 */
export const reversi: GameModule<ReversiState, ReversiMove, ReversiParams> = {
  meta: {
    id: "reversi",
    name: "Reversi",
    family: "grid",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 2,
    summary: "Trap rival lines between your discs to flip them; most discs when the board locks up wins.",
  },
  params: [{ key: "size", label: "Board size", kind: "int", min: 4, max: 10, step: 2, default: 8 }],

  setup: ({ params }) => {
    const g = { width: params.size, height: params.size };
    const m = params.size / 2;
    const cells: (PlayerId | null)[] = new Array(params.size * params.size).fill(null);
    cells[grid.toIndex(g, m - 1, m - 1)] = 1;
    cells[grid.toIndex(g, m, m)] = 1;
    cells[grid.toIndex(g, m, m - 1)] = 0;
    cells[grid.toIndex(g, m - 1, m)] = 0;
    return { ...g, cells, toMove: 0, passes: 0 };
  },

  activePlayers: (s) => (reversi.isTerminal(s) ? [] : [s.toMove]),

  legalMoves(s, player) {
    const options = flanking.placements(s, s.cells, player).map((p) => p.index);
    return options.length > 0 ? options : [PASS];
  },

  applyMove(s, player, move) {
    if (move === PASS) return { ...s, toMove: 1 - player, passes: s.passes + 1 };
    const { x, y } = grid.fromIndex(s, move);
    const cells = s.cells.slice();
    for (const i of flanking.flips(s, s.cells, x, y, player)) cells[i] = player;
    cells[move] = player;
    return { ...s, cells, toMove: 1 - player, passes: 0 };
  },

  isTerminal: (s) => s.passes >= 2 || !s.cells.includes(null),

  outcome: (s) => ({ winners: scoring.scoreWinners(discCounts(s)), scores: discCounts(s) }),

  geometry(s) {
    const geometry = squareGridGeometry(s.width, s.height);
    s.cells.forEach((owner, i) => {
      if (owner === null) return;
      const { x, y } = grid.fromIndex(s, i);
      geometry.pieces.push({ id: `p${i}`, x: x + 0.5, y: y + 0.5, r: 0.4, owner, cellId: gridCellId(x, y) });
    });
    return geometry;
  },

  moveTarget(s, move) {
    if (move === PASS) return undefined;
    const { x, y } = grid.fromIndex(s, move);
    return gridCellId(x, y);
  },

  describeMove(s, move) {
    if (move === PASS) return "pass (no placement flips anything)";
    const { x, y } = grid.fromIndex(s, move);
    const flipped = flanking.flips(s, s.cells, x, y, s.toMove).length;
    return `place at (${x + 1}, ${y + 1}), flipping ${flipped}`;
  },
};
