import type { Geometry, GeometryCell, GeometryPiece } from "@boarddream/engine";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { NEUTRAL_PIECE, PLAYER_COLORS, TILE_COLORS } from "../colors";
import { useFontsReady } from "../fonts";
import { motifFor } from "../motifs";
import { tileColor, zoneColors } from "../three/ground";
import { sizeGroups, uniformSizes } from "../sizeGroups";

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
  const zones = zoneColors(geometry.cells);
  const { probe, fits } = useFittedPrint(geometry);
  return (
    <svg
      className="board"
      viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`}
      role="img"
      aria-label="Game board"
      style={{ aspectRatio: `${width + 2 * pad} / ${height + 2 * pad}` }}
    >
      <defs>
        {[...PLAYER_COLORS, NEUTRAL_PIECE].map((color, i) => (
          <radialGradient key={i} id={i < PLAYER_COLORS.length ? `piece-${i}` : "piece-neutral"} cx="35%" cy="30%" r="80%">
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
        <Cell key={cell.id} cell={cell} zone={zones.get(cell.id)} target={targets.has(cell.id)} fit={fits.get(cell.id)} onClick={(event) => onCell(cell.id, event)} />
      ))}
      {geometry.pieces.map((piece) => (
        <Piece key={piece.id} piece={piece} />
      ))}
      {/* Measures names as they are drawn; React renders it empty and never touches its children. */}
      <text ref={probe} className="cell-label" visibility="hidden" aria-hidden />
    </svg>
  );
}

/** Where a cell's name and token are printed: the name's lines and size, and both their middles. */
interface Fit {
  lines: string[];
  size: number;
  /** The name block's middle, and the token's middle and radius. */
  nameY: number;
  tokenY: number;
  r: number;
}

/** Line spacing, as a share of the font size. */
const LINE = 1.08;
/** Points of a box, as multiples of its half width and height, that must lie inside the cell. */
const BOX = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]] as const;

/** Even-odd point-in-polygon test. */
function inside(polygon: [number, number][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const span = (values: number[]) => Math.max(...values) - Math.min(...values);

/**
 * Fits every cell's name, and the token under it, inside the cell's own shape (a hex, a wedge, a
 * long stall) shrunk toward its middle: the name is measured as the browser draws it, at the size
 * it is drawn (the display font's letters widen as they get smaller), shrunk until it fits, and
 * split in two at a space when that lets it be clearly larger. Fits are kept by cell, so a board
 * redrawn after a move measures only what changed.
 */
function useFittedPrint(geometry: Geometry) {
  const probe = useRef<SVGTextElement>(null);
  const cache = useRef(new Map<string, Fit>());
  const [fits, setFits] = useState(new Map<string, Fit>());
  // Measured in a fallback face, names came out about a tenth too large for their cells.
  const fonts = useFontsReady();
  useLayoutEffect(() => {
    const text = probe.current;
    if (!text || !fonts) return;
    const tiles = geometry.cells.filter((c) => c.kind !== "label").map((c) => span(c.polygon.map(([x]) => x)));
    // Sizes are tuned for cells about one unit wide; boards drawn in bigger units scale them up.
    const unit = Math.max(1, tiles.sort((a, b) => a - b)[Math.floor(tiles.length / 2)] ?? 1);
    const next = new Map<string, Fit>();
    const fit = (cell: GeometryCell, badge: string | undefined, cap?: number) => {
      const key = `${cell.id}|${cell.label ?? ""}|${badge ?? ""}|${cell.polygon.join(";")}|${unit}|${cap ?? ""}`;
      const known = cache.current.get(key) ?? fitCell(text, cell, badge, unit, cap);
      cache.current.set(key, known);
      return known;
    };
    const badgeOf = (cell: GeometryCell) => (cell.kind === "label" || cell.badge === undefined ? undefined : String(cell.badge));
    // Places of one kind and size print their names at one size, that of the name with least room:
    // a row of stalls with names as large as each could hold reads as untidy.
    const sizeGroup = sizeGroups(geometry.cells);
    const groupOf = (cell: GeometryCell) => (cell.kind === "label" ? undefined : sizeGroup(cell));
    const named: { group: string; size: number }[] = [];
    for (const cell of geometry.cells) {
      if (!cell.label && badgeOf(cell) === undefined) continue;
      const own = fit(cell, badgeOf(cell));
      next.set(cell.id, own);
      const group = groupOf(cell);
      if (group && cell.label) named.push({ group, size: own.size });
    }
    const groups = uniformSizes(named);
    for (const cell of geometry.cells) {
      const group = groupOf(cell);
      const own = next.get(cell.id);
      if (!own || !group || !cell.label) continue;
      const size = groups.get(group)!;
      if (own.size > size * 1.001) next.set(cell.id, fit(cell, badgeOf(cell), size));
    }
    if (cache.current.size > 2000) cache.current = new Map([...cache.current].slice(-1000));
    setFits(next);
  }, [geometry, fonts]);
  return { probe, fits };
}

/** Lays the probe out as these lines at this size, and returns its box. */
function measure(text: SVGTextElement, lines: string[], size: number): DOMRect {
  while (text.firstChild) text.removeChild(text.firstChild);
  text.setAttribute("font-size", String(size));
  lines.forEach((line, i) => {
    const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    tspan.setAttribute("x", "0");
    tspan.setAttribute("dy", String(i === 0 ? (-(lines.length - 1) * LINE * size) / 2 : LINE * size));
    tspan.textContent = line;
    text.appendChild(tspan);
  });
  return text.getBBox();
}

function fitCell(text: SVGTextElement, cell: GeometryCell, badge: string | undefined, unit: number, capAt?: number): Fit {
  const isLabel = cell.kind === "label";
  const [cx, cy] = centroid(cell.polygon);
  const share = isLabel ? 0.95 : 0.8;
  const area = cell.polygon.map(([x, y]): [number, number] => [cx + (x - cx) * share, cy + (y - cy) * share]);
  const within = (x: number, y: number, hw: number, hh: number) => BOX.every(([sx, sy]) => inside(area, x + sx * hw, y + sy * hh));
  const width = span(cell.polygon.map(([x]) => x));
  // The token: about a fifth of the cell across, smaller if the cell cannot hold it.
  let r = badge ? Math.min(0.11 * width, 0.12 * unit) : 0;
  while (badge && r > 0.01 && !within(cx, cy, r, r)) r *= 0.9;
  const label = cell.label ?? "";
  if (!label) return { lines: [], size: 0, nameY: cy, tokenY: cy, r };
  const gap = badge ? 0.04 * unit : 0;
  const cap = Math.min((isLabel ? 0.34 : 0.3) * unit, capAt ?? Infinity);
  // The block's middle and the token's, for a name box `h` tall whose middle sits `oy` below its y.
  const place = (h: number, oy: number) => {
    const total = h + gap + 2 * r;
    const mid = cy - total / 2 + h / 2;
    return { nameY: mid - oy, mid, tokenY: cy + total / 2 - r };
  };
  const largest = (lines: string[]): Fit => {
    let size = cap;
    let box = measure(text, lines, size);
    // A first jump to the cell's width, then small steps: letters widen as the size falls.
    size = Math.min(cap, size * ((span(area.map(([x]) => x)) * 0.98) / Math.max(box.width, 1e-6)));
    for (let step = 0; step < 60; step++) {
      box = measure(text, lines, size);
      const at = place(box.height, box.y + box.height / 2);
      if ((within(cx, at.mid, box.width / 2, box.height / 2) && (!badge || within(cx, at.tokenY, r, r))) || size < 0.02 * unit) {
        return { lines, size, nameY: at.nameY, tokenY: at.tokenY, r };
      }
      size *= 0.94;
    }
    const at = place(box.height, box.y + box.height / 2);
    return { lines, size, nameY: at.nameY, tokenY: at.tokenY, r };
  };
  let best = largest([label]);
  const words = label.split(" ");
  if (words.length > 1) {
    // Two lines, split where they come out most even.
    let split = 1;
    for (let i = 1; i < words.length; i++) {
      const longest = (k: number) => Math.max(words.slice(0, k).join(" ").length, words.slice(k).join(" ").length);
      if (longest(i) < longest(split)) split = i;
    }
    const two = largest([words.slice(0, split).join(" "), words.slice(split).join(" ")]);
    if (two.size > best.size * 1.15) best = two;
  }
  return best;
}

interface CellProps {
  cell: GeometryCell;
  /** The color of the cell's group, drawn as a rim inside its edge (zoneColors). */
  zone?: string;
  target: boolean;
  /** Where its name and token go, once measured. */
  fit?: Fit;
  onClick(event: React.MouseEvent): void;
}

function Cell({ cell, zone, target, fit, onClick }: CellProps) {
  const [cx, cy] = centroid(cell.polygon);
  const isLabel = cell.kind === "label";
  const className = ["cell", cell.kind, target && "target"].filter(Boolean).join(" ");
  const fill: CSSProperties | undefined = !isLabel && !target ? { fill: tileColor(cell) } : undefined;
  const inset = (f: number) => cell.polygon.map(([x, y]) => `${cx + (x - cx) * f},${cy + (y - cy) * f}`).join(" ");
  const badge = !isLabel && cell.badge !== undefined ? String(cell.badge) : undefined;
  return (
    <g>
      <polygon points={cell.polygon.map((p) => p.join(",")).join(" ")} className={className} style={fill} onClick={onClick} />
      {zone && <polygon points={inset(0.86)} className="cell-rim" style={{ stroke: zone }} />}
      {cell.segments && <Wedges cell={cell} center={[cx, cy]} />}
      {/* Name and token wait for their measured places, so nothing is drawn out of its cell first. */}
      {cell.label && fit && (
        <text x={cx} y={fit.nameY} className="cell-label" fontSize={fit.size}>
          {fit.lines.map((line, i) => (
            <tspan key={i} x={cx} dy={i === 0 ? (-(fit.lines.length - 1) * LINE * fit.size) / 2 : LINE * fit.size}>
              {line}
            </tspan>
          ))}
        </text>
      )}
      {badge && fit && fit.r > 0 && (
        <g className="cell-token">
          <circle cx={cx} cy={fit.tokenY} r={fit.r} />
          <text x={cx} y={fit.tokenY} fontSize={fit.r * (badge.length > 1 ? 0.95 : 1.15)}>
            {badge}
          </text>
        </g>
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
  const fill = piece.owner === undefined ? "url(#piece-neutral)" : `url(#piece-${piece.owner % PLAYER_COLORS.length})`;
  const Motif = piece.label && piece.label.length > 3 ? motifFor(piece.label) : undefined;
  return (
    <g className="piece">
      {piece.shape === "square" ? (
        <rect x={x - r} y={y - r} width={2 * r} height={2 * r} rx={r * 0.28} fill={fill} filter="url(#piece-shadow)" />
      ) : (
        <circle cx={x} cy={y} r={r} fill={fill} filter="url(#piece-shadow)" />
      )}
      {/* A short label (a number, initials) is printed; a word becomes the motif it names, or
          nothing: as text it would be too small to read. Hovering the piece names it. */}
      {piece.label && piece.label.length <= 3 && (
        <text x={x} y={y} className={piece.owner === undefined ? "piece-label neutral" : "piece-label"} fontSize={r * 1.15}>
          {piece.label}
        </text>
      )}
      {Motif && <Motif x={x - r * 0.62} y={y - r * 0.62} width={r * 1.24} height={r * 1.24} className={piece.owner === undefined ? "piece-motif neutral" : "piece-motif"} />}
      {piece.label && <title>{piece.label}</title>}
    </g>
  );
}
