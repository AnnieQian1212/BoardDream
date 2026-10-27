import { PerspectiveCamera, Vector3 } from "three";
import type { TableLayout } from "./layout";

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Camera tilt above the table, in radians, and vertical field of view in degrees. */
export const ELEVATION = 0.98;
export const FOV = 30;

/**
 * Finds a camera position at a fixed tilt that frames the whole layout inside the part of the
 * screen not covered by side panels, then centers it there.
 */
export function fitCamera(layout: TableLayout, width: number, height: number, insets: Insets) {
  const cam = new PerspectiveCamera(FOV, width / height, 1, 5000);
  cam.setViewOffset(width, height, -(insets.left - insets.right) / 2, -(insets.top - insets.bottom) / 2, width, height);
  const dir = new Vector3(0, Math.sin(ELEVATION), Math.cos(ELEVATION));
  const points = layout.outline.map((p) => new Vector3(...p));
  const margin = 28;
  const free = { x0: insets.left + margin, x1: width - insets.right - margin, y0: insets.top + margin, y1: height - insets.bottom - margin };
  const target = new Vector3((layout.bounds.min[0] + layout.bounds.max[0]) / 2, 0, (layout.bounds.min[2] + layout.bounds.max[2]) / 2);
  const project = (d: number) => {
    cam.position.copy(target).addScaledVector(dir, d);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const p of points) {
      const v = p.clone().project(cam);
      const px = ((v.x + 1) / 2) * width;
      const py = ((1 - v.y) / 2) * height;
      [x0, x1, y0, y1] = [Math.min(x0, px), Math.max(x1, px), Math.min(y0, py), Math.max(y1, py)];
    }
    return { x0, x1, y0, y1 };
  };
  let d = 150;
  for (let pass = 0; pass < 4; pass++) {
    let [lo, hi] = [10, 3000];
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const b = project(mid);
      if (b.x0 >= free.x0 && b.x1 <= free.x1 && b.y0 >= free.y0 && b.y1 <= free.y1) hi = mid;
      else lo = mid;
    }
    d = hi;
    const b = project(d);
    const perPixel = (2 * d * Math.tan((FOV * Math.PI) / 360)) / height;
    target.x += ((b.x0 + b.x1) / 2 - (free.x0 + free.x1) / 2) * perPixel;
    target.z += (((b.y0 + b.y1) / 2 - (free.y0 + free.y1) / 2) * perPixel) / Math.sin(ELEVATION);
  }
  return { target, position: target.clone().addScaledVector(dir, d) };
}

