import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from "three";

/**
 * Water as a soft slab of jelly rather than a flat sheet: each pool domes a little above its tile,
 * rounds off at the shore, and wobbles as a whole when touched. The ripples (water.ts) still run
 * over its surface.
 */

type Polygon = [number, number][];

/**
 * How high the dome rises, and how far in from the shore it takes to get there, per board unit:
 * barely, so water lies about level with its tile rather than bulging above it.
 */
export const DOME = 0.025;
const ROUND = 0.3;
/** Each triangle of the outline's triangulation is cut into SPLITS² smaller ones: enough to round the rim smoothly. */
const SPLITS = 16;
/**
 * Sharpness of the soft minimum over the outline's edges, per rounding width: the distance from
 * the shore blends the nearest edges, so corners round off and the dome has no crease where the
 * nearest edge changes.
 */
const SOFTNESS = 10;

/** Distance from p to the segment a-b, and the unit direction from the segment toward p. */
function fromSegment(px: number, pz: number, [ax, az]: [number, number], [bx, bz]: [number, number]): [number, number, number] {
  const [dx, dz] = [bx - ax, bz - az];
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  const [ox, oz] = [px - (ax + t * dx), pz - (az + t * dz)];
  const d = Math.hypot(ox, oz);
  return d > 1e-9 ? [d, ox / d, oz / d] : [0, 0, 0];
}

/**
 * How far the dome has risen at (x, z) inside `outline` (0 at the shore, 1 once `round` in), and
 * that rise's slope in x and z. The profile is steep at the shore and flat on top, like the edge of
 * a jelly sweet.
 */
export function rise(outline: Polygon, x: number, z: number, round: number): [number, number, number] {
  const kappa = SOFTNESS / round;
  const edges = outline.map((a, i) => fromSegment(x, z, a, outline[(i + 1) % outline.length]));
  const nearest = Math.min(...edges.map(([d]) => d));
  let [sum, gx, gz] = [0, 0, 0];
  for (const [d, nx, nz] of edges) {
    const w = Math.exp(-kappa * (d - nearest));
    [sum, gx, gz] = [sum + w, gx + w * nx, gz + w * nz];
  }
  const distance = nearest - Math.log(sum) / kappa;
  const a = Math.max(0, Math.min(1, distance / round));
  if (a >= 1) return [1, 0, 0];
  // f(a) = 1 - (1 - a)³, so df/dd = 3(1 - a)² / round along the soft distance's gradient.
  const slope = (3 * (1 - a) ** 2) / round;
  return [1 - (1 - a) ** 3, (slope * gx) / sum, (slope * gz) / sum];
}

/**
 * The surface of a tile's pools in the tile's local units (x, z), finely split. Each vertex carries
 * `jelly`, its rise as a share of the dome's height, and `jellySlope`, that rise's slope; the
 * water shader lifts it and wobbles it from there. `pools` are in board units around the cell's
 * center, `k` world units per board unit.
 */
export function jellyGeometry(pools: Polygon[], k: number): BufferGeometry {
  const positions: number[] = [];
  const rises: number[] = [];
  const slopes: number[] = [];
  for (const pool of pools) {
    const outline = pool.map(([x, y]): [number, number] => [x * k, y * k]);
    const triangles = ShapeUtils.triangulateShape(
      outline.map(([x, z]) => new Vector2(x, z)),
      [],
    );
    for (const [i, j, l] of triangles) {
      let [a, b, c] = [outline[i], outline[j], outline[l]];
      // Wound so the surface faces up (+y).
      if ((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) < 0) [b, c] = [c, b];
      const at = (u: number, v: number): [number, number] => [
        a[0] + ((b[0] - a[0]) * u + (c[0] - a[0]) * v) / SPLITS,
        a[1] + ((b[1] - a[1]) * u + (c[1] - a[1]) * v) / SPLITS,
      ];
      const corners: [number, number][] = [];
      for (let u = 0; u < SPLITS; u++)
        for (let v = 0; u + v < SPLITS; v++) {
          corners.push(at(u, v), at(u + 1, v), at(u, v + 1));
          if (u + v + 1 < SPLITS) corners.push(at(u + 1, v), at(u + 1, v + 1), at(u, v + 1));
        }
      for (const [x, z] of corners) {
        const [f, gx, gz] = rise(outline, x, z, ROUND * k);
        positions.push(x, 0, z);
        rises.push(f);
        slopes.push(gx, gz);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  // Filled in where the pool shows a painting.
  g.setAttribute("uv", new Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  g.setAttribute("jelly", new Float32BufferAttribute(rises, 1));
  g.setAttribute("jellySlope", new Float32BufferAttribute(slopes, 2));
  return g;
}

/** Wobbles per second of the dome bouncing, and how quickly it settles (share of critical damping). */
const BOUNCE = 2.6 * 2 * Math.PI;
const SWAY = 2.1 * 2 * Math.PI;
const DAMPING = 0.2;
const REST = 0.01;

/**
 * A pool's wobble as two damped springs: `squash` lowers (or, rebounding, raises) the whole dome
 * as a share of its height, and `sway` tilts its top, in dome heights per board unit. A touch
 * presses the dome down where it lands; it bounces back past level and settles within a second
 * or so, then stops costing anything.
 */
export class Wobble {
  squash = 0;
  sway: [number, number] = [0, 0];
  private speed = 0;
  private swaySpeed: [number, number] = [0, 0];
  private moving = false;

  get still(): boolean {
    return !this.moving;
  }

  /** A touch of `strength` (a share of the dome's height) at direction (dx, dz) from the pool's middle, in board units. */
  poke(strength: number, dx = 0, dz = 0): void {
    this.speed -= strength * BOUNCE;
    // The side that was touched dips.
    this.swaySpeed = [this.swaySpeed[0] - dx * strength * SWAY, this.swaySpeed[1] - dz * strength * SWAY];
    this.moving = true;
  }

  /** Advances by `dt` seconds; returns whether it still moves. */
  step(dt: number): boolean {
    if (!this.moving) return false;
    const steps = Math.ceil(Math.min(dt, 0.05) / (1 / 240));
    const h = Math.min(dt, 0.05) / steps;
    for (let n = 0; n < steps; n++) {
      this.speed += (-BOUNCE * BOUNCE * this.squash - 2 * DAMPING * BOUNCE * this.speed) * h;
      this.squash += this.speed * h;
      for (const axis of [0, 1]) {
        this.swaySpeed[axis] += (-SWAY * SWAY * this.sway[axis] - 2 * DAMPING * SWAY * this.swaySpeed[axis]) * h;
        this.sway[axis] += this.swaySpeed[axis] * h;
      }
    }
    const energy = Math.max(
      Math.abs(this.squash),
      Math.abs(this.speed) / BOUNCE,
      ...this.sway.map(Math.abs),
      ...this.swaySpeed.map((v) => Math.abs(v) / SWAY),
    );
    if (energy < REST) {
      this.squash = this.speed = 0;
      this.sway = [0, 0];
      this.swaySpeed = [0, 0];
      this.moving = false;
    }
    return this.moving;
  }
}
