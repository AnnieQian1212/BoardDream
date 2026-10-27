import type { Geometry } from "@boarddream/engine";
import { PLAYER_COLORS } from "../colors";

interface Props {
  geometry: Geometry;
  /** Cells the human can play on right now. */
  targets: Set<string>;
  onCell(id: string): void;
}

/** Plain SVG render of the engine geometry. Painted art (day 6) is layered over this same layout. */
export function Board({ geometry, targets, onCell }: Props) {
  const pad = 0.1;
  return (
    <svg
      className="board"
      viewBox={`${-pad} ${-pad} ${geometry.width + 2 * pad} ${geometry.height + 2 * pad}`}
      role="img"
      aria-label="Game board"
    >
      {geometry.cells.map((cell) => (
        <polygon
          key={cell.id}
          points={cell.polygon.map((p) => p.join(",")).join(" ")}
          className={targets.has(cell.id) ? "cell target" : "cell"}
          onClick={() => onCell(cell.id)}
        />
      ))}
      {geometry.pieces.map((piece) => (
        <circle
          key={piece.id}
          className="piece"
          cx={piece.x}
          cy={piece.y}
          r={piece.r}
          fill={PLAYER_COLORS[(piece.owner ?? 0) % PLAYER_COLORS.length]}
        />
      ))}
    </svg>
  );
}
