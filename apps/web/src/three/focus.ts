import { Vector3 } from "three";

/**
 * A point the camera leans toward for a moment (a battle), in world units, until a time on
 * performance.now()'s clock. CameraRig eases a little way toward it, then back.
 */
export const lean = { point: new Vector3(), until: 0 };

export function leanToward(point: Vector3, seconds: number) {
  lean.point.copy(point);
  lean.until = performance.now() + seconds * 1000;
}
