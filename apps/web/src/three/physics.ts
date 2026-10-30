import type { BufferGeometry, Object3D } from "three";

/**
 * Real physics for resource tokens: a gained token falls on to its heap, bounces, tumbles and
 * knocks the others about; a spent one leaves a gap the rest settle into. Each heap is its own tiny
 * Rapier world in the heap's local units (a token is about one unit across), stepped only while
 * something moves, so a quiet table costs nothing.
 */

type Rapier = typeof import("@dimforge/rapier3d-compat");
type World = import("@dimforge/rapier3d-compat").World;
type RigidBody = import("@dimforge/rapier3d-compat").RigidBody;

let loading: Promise<Rapier> | undefined;
/** Rapier is a 2 MB module (WebAssembly inlined), so it loads on first use. */
export function loadRapier(): Promise<Rapier> {
  loading ??= import("@dimforge/rapier3d-compat").then(async (rapier) => {
    await rapier.init();
    return rapier;
  });
  return loading;
}

/** Slow enough to watch a token fall from a few heights up, quick enough not to float. */
const GRAVITY = 60;
const STEP = 1 / 60;
/** Seconds between tokens when several arrive at once. */
const STAGGER = 0.09;
/** After this long without a new event the heap stops stepping, even if a token still jitters. */
const SETTLE = 4;
/**
 * Steps in a row with every token too slow to notice moving (a coin can creep along another's
 * rim for seconds), after which the heap stops: it holds still until something new happens.
 */
const QUIET = 15;
/** Below this speed a token has landed: it is damped hard so it settles instead of wobbling on a rim. */
const LANDED = 1.5;
/** Past this radius a token heading out is braked: a wall would leave tokens leaning on nothing. */
const REACH = 1.9;

export interface TokenFeel {
  /** The token's mesh, standing on y = 0; its convex hull is the collider, unless it is a cylinder. */
  geometry: BufferGeometry;
  friction: number;
  restitution: number;
  /**
   * Coins and discs, as a cylinder standing on y = 0. A rounded cylinder rests and slides cleanly
   * where stacked polygon hulls jitter, and one left standing on its rim is tipped over.
   */
  cylinder?: { radius: number; height: number };
}

export class PileSim {
  private readonly world: World;
  private readonly bodies: (RigidBody | undefined)[] = [];
  private readonly hull: Float32Array;
  /** Tokens waiting to fall: their index and the time each is due. */
  private queue: { index: number; at: number }[] = [];
  private clock = 0;
  private lastEvent = -Infinity;
  private accumulated = 0;
  /** Steps in a row with every token nearly still. */
  private quiet = 0;

  constructor(
    private readonly rapier: Rapier,
    private readonly feel: TokenFeel,
    private readonly random: () => number = Math.random,
  ) {
    this.world = new rapier.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = STEP;
    this.hull = Float32Array.from(feel.geometry.attributes.position.array);
    // The mat.
    this.world.createCollider(rapier.ColliderDesc.cuboid(REACH * 4, 0.5, REACH * 4).setTranslation(0, -0.5, 0).setFriction(0.8));
  }

  get count(): number {
    return this.bodies.length;
  }

  /** Whether the heap still needs steps (and frames). */
  get awake(): boolean {
    if (this.queue.length > 0) return true;
    if (this.clock - this.lastEvent > SETTLE || this.quiet >= QUIET) return false;
    return this.bodies.some((b) => b && !b.isSleeping());
  }

  /** Grows or shrinks the heap to `count` tokens: new ones fall in turn, removed ones vanish from the top. */
  sync(count: number): void {
    while (this.bodies.length > count) {
      const body = this.bodies.pop();
      this.queue = this.queue.filter((q) => q.index < this.bodies.length);
      if (body) this.world.removeRigidBody(body);
      // What rested on it falls.
      for (const b of this.bodies) b?.wakeUp();
      this.stir();
    }
    const start = Math.max(this.clock, ...this.queue.map((q) => q.at));
    for (let n = 0; this.bodies.length < count; n++) {
      this.queue.push({ index: this.bodies.length, at: start + n * STAGGER });
      this.bodies.push(undefined);
    }
    if (this.queue.length) this.stir();
  }

  /** Something happened: the heap needs steps again until it is still. */
  private stir(): void {
    this.lastEvent = this.clock;
    this.quiet = 0;
  }

  /** Advances by `dt` seconds of frame time, in fixed steps. */
  step(dt: number): void {
    this.accumulated += Math.min(dt, 1 / 20);
    for (let n = 0; this.accumulated >= STEP && n < 4; n++) {
      this.accumulated -= STEP;
      this.clock += STEP;
      for (const q of this.queue.filter((q) => q.at <= this.clock)) this.drop(q.index);
      this.queue = this.queue.filter((q) => q.at > this.clock);
      this.gather();
      if (this.feel.cylinder) this.tip();
      this.world.step();
      this.calm();
    }
  }

  /**
   * Tokens tumble freely in the air but are damped hard once they have landed, so a coin tilted
   * on another's rim settles instead of wobbling there; counts the steps the heap has been still.
   */
  private calm(): void {
    let still = true;
    for (const body of this.bodies) {
      if (!body || body.isSleeping()) continue;
      const v = body.linvel();
      const w = body.angvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      const landed = speed < LANDED;
      body.setLinearDamping(landed ? 2 : 0.1);
      body.setAngularDamping(landed ? 6 : this.feel.cylinder ? 1.5 : 0.4);
      if (speed > 0.25 || Math.hypot(w.x, w.y, w.z) > 1) still = false;
    }
    this.quiet = still ? this.quiet + 1 : 0;
  }

  /** Brakes tokens heading away from the heap past REACH, so a rolling coin stops near it. */
  private gather(): void {
    for (const body of this.bodies) {
      if (!body || body.isSleeping()) continue;
      const { x, z } = body.translation();
      const r = Math.hypot(x, z);
      if (r <= REACH) continue;
      const v = body.linvel();
      const outward = (v.x * x + v.z * z) / r;
      if (outward <= 0) continue;
      // Takes a quarter of the outward speed each step.
      const push = body.mass() * outward * 0.25;
      body.applyImpulse({ x: (-x / r) * push, y: 0, z: (-z / r) * push }, false);
    }
  }

  /**
   * A coin's rim is a polygon in the collider, with flat sides it can balance on, and a rolling
   * coin keeps itself upright. One standing nearly upright, still or rolling, gets a small push
   * each step toward lying flat, the way it leans, as a real coin topples when it slows.
   */
  private tip(): void {
    for (const body of this.bodies) {
      if (!body || body.isSleeping()) continue;
      const { x, y, z, w } = body.rotation();
      // The coin's axis: its local up turned by the rotation.
      const [ux, uy, uz] = [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)];
      if (Math.abs(uy) > 0.5 || Math.hypot(ux, uz) < 1e-3) continue;
      // Turning about (axis × up) tips the axis toward straight up (or down), and the coin falls
      // away from where its axis points. A leaning coin goes the way it leans; an upright one
      // falls toward the middle of the heap.
      const t = body.translation();
      const sign = Math.abs(uy) > 0.15 ? Math.sign(uy) : ux * t.x + uz * t.z >= 0 ? 1 : -1;
      const length = Math.hypot(ux, uz);
      body.applyTorqueImpulse({ x: (-uz / length) * 0.02 * sign, y: 0, z: (ux / length) * 0.02 * sign }, true);
    }
  }

  /** Copies token `i`'s pose on to an object; false while it has not started to fall. */
  pose(i: number, object: Object3D): boolean {
    const body = this.bodies[i];
    if (!body) return false;
    const t = body.translation();
    const r = body.rotation();
    object.position.set(t.x, t.y, t.z);
    object.quaternion.set(r.x, r.y, r.z, r.w);
    return true;
  }

  free(): void {
    this.world.free();
  }

  private body(position: [number, number, number], quaternion: [number, number, number, number]): RigidBody {
    const { rapier } = this;
    const body = this.world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(...position)
        .setRotation({ x: quaternion[0], y: quaternion[1], z: quaternion[2], w: quaternion[3] })
        .setCcdEnabled(true)
        .setLinearDamping(0.1)
        // Coins and discs roll on their rims; more damping stops them before they reach the ring.
        .setAngularDamping(this.feel.cylinder ? 1.5 : 0.4),
    );
    const round = this.feel.cylinder;
    const edge = round && Math.min(0.06, round.height / 4);
    const collider = round
      ? rapier.ColliderDesc.roundCylinder(round.height / 2 - edge!, round.radius - edge!, edge!).setTranslation(0, round.height / 2, 0)
      : (rapier.ColliderDesc.convexHull(this.hull) ?? rapier.ColliderDesc.ball(0.6));
    this.world.createCollider(collider.setFriction(this.feel.friction).setRestitution(this.feel.restitution), body);
    return body;
  }

  /** Token `index` falls from above the heap, a little off center and turning. */
  private drop(index: number): void {
    const r = this.random;
    // Above the heap's top, counting only tokens that have landed, not those still in the air.
    const top = Math.max(0, ...this.bodies.map((b) => (b && Math.abs(b.linvel().y) < 2 ? b.translation().y : 0)));
    const [ax, ay, az] = [r() * Math.PI * 2, r() * Math.PI * 2, r() * 0.6];
    // A random turn, as a quaternion from Euler angles (x, y, z order).
    const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax / 2), Math.sin(ax / 2), Math.cos(ay / 2), Math.sin(ay / 2), Math.cos(az / 2), Math.sin(az / 2)];
    const quaternion: [number, number, number, number] = [
      sx * cy * cz + cx * sy * sz,
      cx * sy * cz - sx * cy * sz,
      cx * cy * sz + sx * sy * cz,
      cx * cy * cz - sx * sy * sz,
    ];
    const body = this.body([(r() - 0.5) * 1.2, top + 4.5, (r() - 0.5) * 1.2], quaternion);
    body.setLinvel({ x: (r() - 0.5) * 2, y: -4, z: (r() - 0.5) * 2 }, true);
    body.setAngvel({ x: (r() - 0.5) * 8, y: (r() - 0.5) * 8, z: (r() - 0.5) * 8 }, true);
    this.bodies[index] = body;
    for (const b of this.bodies) b?.wakeUp();
    this.stir();
  }
}
