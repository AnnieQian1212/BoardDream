import type { Geometry } from "./types";

export const gridCellId = (x: number, y: number) => `${x},${y}`;

/** Square grid with one unit per cell; cell ids are "x,y" with y = 0 at the top. */
export function squareGridGeometry(cols: number, rows: number): Geometry {
  const cells: Geometry["cells"] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      cells.push({ id: gridCellId(x, y), polygon: rectPolygon(x, y, 1, 1) });
    }
  }
  return { width: cols, height: rows, cells, pieces: [] };
}

export function rectPolygon(x: number, y: number, width: number, height: number): [number, number][] {
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
}

export function regularPolygon(cx: number, cy: number, radius: number, sides: number): [number, number][] {
  return Array.from({ length: sides }, (_, i) => {
    const angle = (2 * Math.PI * i) / sides;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

/**
 * Pieces as the table can draw them. Rules checked now must place every piece (checkGeometry), but
 * a game saved before may name only the cell a piece stands on (`cell` or `cellId`), with no x, y
 * or r: its pieces were drawn at NaN and the camera, framing them, showed an empty table. Such a
 * piece stands at its cell's middle, a fifth of the cell across; one with no cell is left off.
 */
function placedPieces(geometry: Geometry): Geometry["pieces"] {
  if (geometry.pieces.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.r > 0)) return geometry.pieces;
  const cells = new Map(geometry.cells.map((c) => [c.id, c]));
  return geometry.pieces.flatMap((piece) => {
    const cell = cells.get(piece.cellId ?? String((piece as { cell?: unknown }).cell));
    const xs = cell?.polygon.map(([x]) => x) ?? [];
    const ys = cell?.polygon.map(([, y]) => y) ?? [];
    const placed = Number.isFinite(piece.x) && Number.isFinite(piece.y);
    if (!placed && !cell) return [];
    const x = placed ? piece.x : xs.reduce((a, b) => a + b, 0) / xs.length;
    const y = placed ? piece.y : ys.reduce((a, b) => a + b, 0) / ys.length;
    const r = piece.r > 0 ? piece.r : cell ? 0.2 * Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) : 0.3;
    return [{ ...piece, x, y, r, cellId: piece.cellId ?? cell?.id }];
  });
}

/**
 * The geometry grown, and shifted where it reaches below zero, so its size covers every cell and
 * piece. Generated boards sometimes draw past the size they declare (a third player's area beside a
 * board sized for two); drawn as declared, those spaces would hang off the board. Pieces named only
 * by their cell are placed first (placedPieces).
 */
export function fitBounds(geometry: Geometry): Geometry {
  const pieces = placedPieces(geometry);
  if (pieces !== geometry.pieces) geometry = { ...geometry, pieces };
  let [minX, minY, maxX, maxY] = [0, 0, geometry.width, geometry.height];
  const take = (x: number, y: number, r = 0) => {
    minX = Math.min(minX, x - r);
    minY = Math.min(minY, y - r);
    maxX = Math.max(maxX, x + r);
    maxY = Math.max(maxY, y + r);
  };
  for (const cell of geometry.cells) for (const [x, y] of cell.polygon) take(x, y);
  for (const piece of geometry.pieces) take(piece.x, piece.y, piece.r);
  if (minX === 0 && minY === 0 && maxX === geometry.width && maxY === geometry.height) return geometry;
  const [dx, dy] = [-minX, -minY];
  return {
    ...geometry,
    width: maxX - minX,
    height: maxY - minY,
    cells: geometry.cells.map((cell) => ({ ...cell, polygon: cell.polygon.map(([x, y]) => [x + dx, y + dy] as [number, number]) })),
    pieces: geometry.pieces.map((piece) => ({ ...piece, x: piece.x + dx, y: piece.y + dy })),
  };
}

/** Ray casting: whether a point lies inside a polygon. */
export function insidePolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** How far a point lies from a polygon: 0 inside it. */
function distanceTo(x: number, y: number, polygon: [number, number][]): number {
  if (insidePolygon(x, y, polygon)) return 0;
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i];
    const [bx, by] = polygon[(i + 1) % polygon.length];
    const [dx, dy] = [bx - ax, by - ay];
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

/** A block of a board with nothing drawn in it, as shares of the board's area, width and height. */
export interface BoardGap {
  area: number;
  width: number;
  height: number;
  /** Where the block lies, in words: "at the bottom left", "along the right side". */
  where: string;
}

/**
 * The largest rectangle of a board that no cell reaches, counting the gaps between tiles (half a
 * usual tile) as part of the tiles beside them. A large one is a board laid out lopsided: a grid in
 * one corner beside a long column of action spaces leaves a block as big as the grid empty, and a
 * board sized larger than its cells leaves a band along one edge.
 */
export function largestGap(geometry: Geometry, samples = 80): BoardGap {
  const board = fitBounds(geometry);
  const cells = board.cells
    .filter((cell) => Array.isArray(cell.polygon) && cell.polygon.length >= 3)
    .map((cell) => {
      const xs = cell.polygon.map(([x]) => x);
      const ys = cell.polygon.map(([, y]) => y);
      return { cell, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
    });
  const tiles = cells
    .filter(({ cell }) => cell.kind !== "vertex" && cell.kind !== "edge")
    .map(({ box: [x0, y0, x1, y1] }) => Math.min(x1 - x0, y1 - y0))
    .sort((a, b) => a - b);
  const reach = 0.5 * (tiles[Math.floor(tiles.length / 2)] ?? 0);
  const step = Math.max(board.width, board.height) / samples;
  const cols = Math.max(1, Math.round(board.width / step));
  const rows = Math.max(1, Math.round(board.height / step));
  const [sx, sy] = [board.width / cols, board.height / rows];
  const reached = (x: number, y: number) =>
    cells.some(
      ({ cell, box: [x0, y0, x1, y1] }) =>
        x >= x0 - reach && x <= x1 + reach && y >= y0 - reach && y <= y1 + reach && distanceTo(x, y, cell.polygon) <= reach,
    );
  // Row by row, the run of empty samples above each column; the largest rectangle under that skyline.
  const run = new Array<number>(cols).fill(0);
  let best = { area: 0, left: 0, right: 0, top: 0, bottom: 0 };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) run[c] = reached((c + 0.5) * sx, (r + 0.5) * sy) ? 0 : run[c] + 1;
    for (let c = 0; c < cols; c++) {
      let low = Infinity;
      for (let end = c; end < cols && run[end] > 0; end++) {
        low = Math.min(low, run[end]);
        const area = low * (end - c + 1);
        if (area > best.area) best = { area, left: c, right: end + 1, top: r + 1 - low, bottom: r + 1 };
      }
    }
  }
  const width = (best.right - best.left) / cols;
  const height = (best.bottom - best.top) / rows;
  const [cx, cy] = [(best.left + best.right) / 2 / cols, (best.top + best.bottom) / 2 / rows];
  const across = cy < 0.5 ? "top" : "bottom";
  const down = cx < 0.5 ? "left" : "right";
  const vertical = cy < 1 / 3 ? "top" : cy > 2 / 3 ? "bottom" : "";
  const horizontal = cx < 1 / 3 ? "left" : cx > 2 / 3 ? "right" : "";
  const where =
    width >= 0.9 ? `along the ${across}` : height >= 0.9 ? `along the ${down} side` : vertical || horizontal ? `at the ${[vertical, horizontal].filter(Boolean).join(" ")}` : "in the middle";
  return { area: best.area / (rows * cols), width, height, where };
}
