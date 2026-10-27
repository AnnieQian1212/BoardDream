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
