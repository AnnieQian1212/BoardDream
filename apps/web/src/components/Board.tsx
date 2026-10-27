import type { Geometry, GeometryCell, GeometryPiece } from "@boarddream/engine";
import { PLAYER_COLORS } from "../colors";

interface Props {
  geometry: Geometry;
  /** Cells the human can play on right now. */
  targets: Set<string>;
  onCell(id: string): void;
}

const colorOf = (owner: number | undefined) => PLAYER_COLORS[(owner ?? 0) % PLAYER_COLORS.length];

const centroid = (polygon: [number, number][]) => [
  polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length,
  polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length,
];

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
        <Cell key={cell.id} cell={cell} target={targets.has(cell.id)} onClick={() => onCell(cell.id)} />
      ))}
      {geometry.pieces.map((piece) => (
        <Piece key={piece.id} piece={piece} />
      ))}
    </svg>
  );
}

function Cell({ cell, target, onClick }: { cell: GeometryCell; target: boolean; onClick(): void }) {
  const [cx, cy] = centroid(cell.polygon);
  const isLabel = cell.kind === "label";
  const className = ["cell", cell.kind, target && "target"].filter(Boolean).join(" ");
  const tint = !isLabel && !target && cell.owner !== undefined ? { fill: colorOf(cell.owner), fillOpacity: 0.18 } : undefined;
  return (
    <g>
      <polygon points={cell.polygon.map((p) => p.join(",")).join(" ")} className={className} style={tint} onClick={onClick} />
      {cell.label && (
        <text x={cx} y={cy} className="cell-label">
          {cell.label}
        </text>
      )}
    </g>
  );
}

function Piece({ piece }: { piece: GeometryPiece }) {
  const { x, y, r } = piece;
  return (
    <g className="piece">
      {piece.shape === "square" ? (
        <rect x={x - r} y={y - r} width={2 * r} height={2 * r} rx={r * 0.25} fill={colorOf(piece.owner)} />
      ) : (
        <circle cx={x} cy={y} r={r} fill={colorOf(piece.owner)} />
      )}
      {piece.label && (
        <text x={x} y={y} className="piece-label" fontSize={r * 1.2}>
          {piece.label}
        </text>
      )}
    </g>
  );
}
