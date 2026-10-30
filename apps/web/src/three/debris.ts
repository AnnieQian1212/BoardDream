/**
 * Chips of stone knocked loose by a click on stony ground: a handful fly up from the point, bounce
 * on the board, settle and shrink away, under a puff of dust. Plain ballistic steps on the CPU,
 * only while something is in the air or fading; a quiet board steps nothing.
 */

/** Chips alive at once; a new burst reuses the oldest. */
export const MAX_CHIPS = 40;
const PER_BURST = 10;
/** Seconds a chip lies before it shrinks away, and how long that takes. */
const LIFE = 1.6;
const FADE = 0.4;
/** Seconds a puff of dust takes to spread and clear. */
export const DUST_LIFE = 0.9;
const MAX_DUST = 3;

export class ChipPool {
  readonly x = new Float32Array(MAX_CHIPS);
  readonly y = new Float32Array(MAX_CHIPS);
  readonly z = new Float32Array(MAX_CHIPS);
  /** Tumble about two axes, in radians. */
  readonly spinX = new Float32Array(MAX_CHIPS);
  readonly spinY = new Float32Array(MAX_CHIPS);
  /** Seconds since the chip flew; Infinity for a free slot. */
  readonly age = new Float32Array(MAX_CHIPS).fill(Infinity);
  readonly size = new Float32Array(MAX_CHIPS);
  /** Where each puff of dust rose and how old it is (Infinity once it has cleared). */
  readonly dust = Array.from({ length: MAX_DUST }, () => ({ x: 0, z: 0, age: Infinity }));
  private readonly vx = new Float32Array(MAX_CHIPS);
  private readonly vy = new Float32Array(MAX_CHIPS);
  private readonly vz = new Float32Array(MAX_CHIPS);
  private readonly tumbleX = new Float32Array(MAX_CHIPS);
  private readonly tumbleY = new Float32Array(MAX_CHIPS);
  /** The height each chip will land on: a tile's top, or the slab below for one that misses the tiles. */
  private readonly landing = new Float32Array(MAX_CHIPS);
  private next = 0;
  private nextDust = 0;

  /**
   * `floor` is the height of the tiles' tops and `scale` a typical cell's width, in world units.
   * A chip coming down where `ground` says no tile lies (past the board's edge, or into a gap)
   * drops on to `low` instead.
   */
  constructor(
    readonly floor: number,
    readonly scale: number,
    private readonly ground: (x: number, z: number) => boolean = () => true,
    private readonly low = floor,
  ) {}

  get active(): boolean {
    return this.age.some(Number.isFinite) || this.dust.some((d) => Number.isFinite(d.age));
  }

  /** Knocks chips loose at (x, z), flying out every way and up. */
  burst(x: number, z: number, random: () => number = Math.random): void {
    const s = this.scale;
    for (let n = 0; n < PER_BURST; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_CHIPS;
      const angle = random() * Math.PI * 2;
      const speed = (0.35 + random() * 0.5) * s;
      [this.x[i], this.y[i], this.z[i]] = [x + Math.cos(angle) * 0.02 * s, this.floor + 0.02 * s, z + Math.sin(angle) * 0.02 * s];
      [this.vx[i], this.vy[i], this.vz[i]] = [Math.cos(angle) * speed, (1.7 + random() * 0.9) * s, Math.sin(angle) * speed];
      [this.tumbleX[i], this.tumbleY[i]] = [(random() - 0.5) * 24, (random() - 0.5) * 24];
      this.size[i] = (0.045 + random() * 0.045) * s;
      this.landing[i] = this.floor;
      this.age[i] = 0;
    }
    this.dust[this.nextDust] = { x, z, age: 0 };
    this.nextDust = (this.nextDust + 1) % MAX_DUST;
  }

  /** Advances everything by `dt` seconds. Returns whether anything is still moving or fading. */
  step(dt: number): boolean {
    const g = 9 * this.scale;
    for (let i = 0; i < MAX_CHIPS; i++) {
      if (!Number.isFinite(this.age[i])) continue;
      this.age[i] += dt;
      if (this.age[i] > LIFE + FADE) {
        this.age[i] = Infinity;
        continue;
      }
      const resting = this.y[i] <= this.landing[i] && this.vy[i] === 0;
      if (!resting) this.vy[i] -= g * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
      this.spinX[i] += this.tumbleX[i] * dt;
      this.spinY[i] += this.tumbleY[i] * dt;
      if (this.y[i] < this.landing[i] && this.landing[i] === this.floor && !this.ground(this.x[i], this.z[i])) this.landing[i] = this.low;
      if (this.y[i] < this.landing[i]) {
        this.y[i] = this.landing[i];
        // Each landing loses most of the bounce and the slide; a small bounce comes to rest.
        this.vy[i] = -this.vy[i] < 0.5 * this.scale ? 0 : -this.vy[i] * 0.35;
        this.vx[i] *= 0.5;
        this.vz[i] *= 0.5;
        this.tumbleX[i] *= 0.4;
        this.tumbleY[i] *= 0.4;
      }
      if (resting) {
        const drag = Math.exp(-10 * dt);
        this.vx[i] *= drag;
        this.vz[i] *= drag;
        this.tumbleX[i] *= drag;
        this.tumbleY[i] *= drag;
      }
    }
    for (const d of this.dust) if (Number.isFinite(d.age)) d.age = d.age + dt > DUST_LIFE ? Infinity : d.age + dt;
    return this.active;
  }

  /** A chip's drawn size: full until its time is up, then shrinking to nothing; 0 for a free slot. */
  drawnSize(i: number): number {
    const age = this.age[i];
    if (!Number.isFinite(age)) return 0;
    return this.size[i] * (age < LIFE ? 1 : Math.max(0, 1 - (age - LIFE) / FADE));
  }
}
