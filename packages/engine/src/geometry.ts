import type { Geometry } from "./types";

export const gridCellId = (x: number, y: number) => `${x},${y}`;

/** Square grid with one unit per cell; cell ids are "x,y" with y = 0 at the top. */
export function squareGridGeometry(cols: number, rows: number): Geometry {
  const cells: Geometry["cells"] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      cells.push({
        id: gridCellId(x, y),
        polygon: [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1],
        ],
      });
    }
  }
  return { width: cols, height: rows, cells, pieces: [] };
}
