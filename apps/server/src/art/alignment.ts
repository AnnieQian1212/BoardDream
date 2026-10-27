import type { Geometry } from "@boarddream/engine";

/** Binary mask, row-major, one byte per pixel. */
export interface Mask {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Fills a polygon (pixel coordinates) by sampling pixel centers, even-odd rule. */
export function rasterizePolygon(points: readonly (readonly [number, number])[], width: number, height: number): Mask {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const cy = y + 0.5;
    const crossings: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= cy && y2 > cy) || (y2 <= cy && y1 > cy)) crossings.push(x1 + ((cy - y1) / (y2 - y1)) * (x2 - x1));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.max(0, Math.ceil(crossings[i] - 0.5));
      const to = Math.min(width - 1, Math.ceil(crossings[i + 1] - 0.5) - 1);
      for (let x = from; x <= to; x++) data[y * width + x] = 1;
    }
  }
  return { width, height, data };
}

export function maskIoU(a: Mask, b: Mask): number {
  if (a.width !== b.width || a.height !== b.height) throw new Error("mask sizes differ");
  let intersection = 0;
  let union = 0;
  for (let i = 0; i < a.data.length; i++) {
    const inA = a.data[i] > 0;
    const inB = b.data[i] > 0;
    if (inA && inB) intersection++;
    if (inA || inB) union++;
  }
  return union === 0 ? 1 : intersection / union;
}

/** The mask each cell should occupy when the geometry is rendered at `pxPerUnit`. */
export function expectedCellMasks(geometry: Geometry, pxPerUnit: number): Map<string, Mask> {
  const width = Math.round(geometry.width * pxPerUnit);
  const height = Math.round(geometry.height * pxPerUnit);
  return new Map(
    geometry.cells.map((cell) => [
      cell.id,
      rasterizePolygon(
        cell.polygon.map(([x, y]) => [x * pxPerUnit, y * pxPerUnit] as const),
        width,
        height,
      ),
    ]),
  );
}

export interface AlignmentReport {
  meanIoU: number;
  /** Share of cells at or above the threshold. */
  alignedShare: number;
  /** Cells to send back for a targeted edit. */
  misaligned: { id: string; iou: number }[];
}

/** Compares SAM masks of the painted board against the engine's cell geometry. */
export function alignmentReport(expected: Map<string, Mask>, actual: Map<string, Mask>, threshold = 0.8): AlignmentReport {
  const scores = [...expected].map(([id, mask]) => {
    const found = actual.get(id);
    return { id, iou: found ? maskIoU(mask, found) : 0 };
  });
  const aligned = scores.filter((s) => s.iou >= threshold).length;
  return {
    meanIoU: scores.reduce((sum, s) => sum + s.iou, 0) / Math.max(1, scores.length),
    alignedShare: aligned / Math.max(1, scores.length),
    misaligned: scores.filter((s) => s.iou < threshold).sort((a, b) => a.iou - b.iou),
  };
}
