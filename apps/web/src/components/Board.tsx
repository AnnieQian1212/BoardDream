import type { Geometry, GeometryCell, GeometryPiece } from "@boarddream/engine";
import type { CSSProperties } from "react";
import { PLAYER_COLORS, playerColor, TILE_COLORS } from "../colors";

interface Props {
  geometry: Geometry;
  /** Cells the human can play on right now. */
  targets: Set<string>;
  onCell(id: string, event: React.MouseEvent): void;
}

/** Blends a #rrggbb color toward white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

const centroid = (polygon: [number, number][]) => [
  polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length,
  polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length,
];

/** SVG render of the engine geometry. Painted art (day 6) is layered over this same layout. */
export function Board({ geometry, targets, onCell }: Props) {
  const pad = 0.4;
  const { width, height } = geometry;
  return (
    <svg
      className="board"
      viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`}
      role="img"
      aria-label="Game board"
      style={{ aspectRatio: `${width + 2 * pad} / ${height + 2 * pad}` }}
    >
      <defs>
        {PLAYER_COLORS.map((color, i) => (
          <radialGradient key={i} id={`piece-${i}`} cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor={shade(color, 0.45)} />
            <stop offset="55%" stopColor={color} />
            <stop offset="100%" stopColor={shade(color, -0.35)} />
          </radialGradient>
        ))}
        <linearGradient id="board-paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4ebd8" />
          <stop offset="100%" stopColor="#e3d4b6" />
        </linearGradient>
        <filter id="board-shadow" x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow dx="0" dy={height * 0.015} stdDeviation={height * 0.02} floodOpacity="0.55" />
        </filter>
        <filter id="piece-shadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="0.05" stdDeviation="0.05" floodOpacity="0.5" />
        </filter>
      </defs>
      <rect
        className="board-base"
        x={-pad * 0.75}
        y={-pad * 0.75}
        width={width + pad * 1.5}
        height={height + pad * 1.5}
        rx={pad * 0.9}
        filter="url(#board-shadow)"
      />
      {geometry.cells.map((cell) => (
        <Cell key={cell.id} cell={cell} target={targets.has(cell.id)} onClick={(event) => onCell(cell.id, event)} />
      ))}
      {geometry.pieces.map((piece) => (
        <Piece key={piece.id} piece={piece} />
      ))}
    </svg>
  );
}

/** Label size that fits the cell's width: long labels in small cells shrink. */
function labelSize(cell: GeometryCell, label: string): number {
  const xs = cell.polygon.map(([x]) => x);
  const width = Math.max(...xs) - Math.min(...xs);
  return Math.min(0.32, (1.3 * width) / Math.max(1, label.length));
}

function Cell({ cell, target, onClick }: { cell: GeometryCell; target: boolean; onClick(event: React.MouseEvent): void }) {
  const [cx, cy] = centroid(cell.polygon);
  const isLabel = cell.kind === "label";
  const className = ["cell", cell.kind, target && "target"].filter(Boolean).join(" ");
  const tint: CSSProperties | undefined =
    !isLabel && !target && cell.owner !== undefined ? { fill: shade(playerColor(cell.owner), 0.55) } : undefined;
  return (
    <g>
      <polygon points={cell.polygon.map((p) => p.join(",")).join(" ")} className={className} style={tint} onClick={onClick} />
      {cell.segments && <Wedges cell={cell} center={[cx, cy]} />}
      {cell.label && (
        <text x={cx} y={cy} className="cell-label" fontSize={labelSize(cell, cell.label)}>
          {cell.label}
        </text>
      )}
    </g>
  );
}

/** Edge-matched tile: a wedge per edge in its terrain's color, inset so the tile's rim shows. */
function Wedges({ cell, center: [cx, cy] }: { cell: GeometryCell; center: number[] }) {
  const n = cell.polygon.length;
  const inset = ([x, y]: [number, number]) => `${cx + (x - cx) * 0.84},${cy + (y - cy) * 0.84}`;
  return (
    <g className="wedges">
      {cell.segments!.map((kind, i) => (
        <polygon key={i} points={`${cx},${cy} ${inset(cell.polygon[i % n])} ${inset(cell.polygon[(i + 1) % n])}`} fill={TILE_COLORS[kind] ?? "#c9bfa8"} />
      ))}
    </g>
  );
}

function Piece({ piece }: { piece: GeometryPiece }) {
  const { x, y, r } = piece;
  const fill = `url(#piece-${(piece.owner ?? 0) % PLAYER_COLORS.length})`;
  return (
    <g className="piece">
      {piece.shape === "square" ? (
        <rect x={x - r} y={y - r} width={2 * r} height={2 * r} rx={r * 0.28} fill={fill} filter="url(#piece-shadow)" />
      ) : (
        <circle cx={x} cy={y} r={r} fill={fill} filter="url(#piece-shadow)" />
      )}
      {piece.label && (
        <text x={x} y={y} className="piece-label" fontSize={r * 1.15}>
          {piece.label}
        </text>
      )}
    </g>
  );
}
