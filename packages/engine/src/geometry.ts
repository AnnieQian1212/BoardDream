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
 * The geometry grown, and shifted where it reaches below zero, so its size covers every cell and
 * piece. Generated boards sometimes draw past the size they declare (a third player's area beside a
 * board sized for two); drawn as declared, those spaces would hang off the board.
 */
export function fitBounds(geometry: Geometry): Geometry {
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
