import { CylinderGeometry, Object3D, OctahedronGeometry, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { seeded } from "./paint";
import { loadRapier, PileSim } from "./physics";

const COIN = { geometry: new CylinderGeometry(0.82, 0.82, 0.28, 24).translate(0, 0.14, 0), friction: 0.45, restitution: 0.3, cylinder: { radius: 0.82, height: 0.28 } };
const CRYSTAL = { geometry: new OctahedronGeometry(0.78).scale(0.9, 1.3, 0.9).translate(0, 1, 0), friction: 0.5, restitution: 0.2 };

/** Steps at 60 frames a second until the heap sleeps; returns the seconds it took. */
function settle(sim: PileSim, limit = 8): number {
  let t = 0;
  for (; sim.awake && t < limit; t += 1 / 60) sim.step(1 / 60);
  return t;
}

const poses = (sim: PileSim) =>
  Array.from({ length: sim.count }, (_, i) => {
    const o = new Object3D();
    return sim.pose(i, o) ? o.position.clone() : undefined;
  });

describe("token heaps", () => {
  it("drop new tokens in turn and let them come to rest on the mat, inside the ring", async () => {
    const sim = new PileSim(await loadRapier(), COIN, seeded(1));
    sim.sync(6);
    // They fall one after another, not all at once.
    sim.step(1 / 60);
    expect(poses(sim).filter(Boolean)).toHaveLength(1);
    expect(settle(sim)).toBeLessThan(6);
    for (const p of poses(sim)) {
      expect(p).toBeDefined();
      expect(p!.y).toBeGreaterThan(-0.05);
      expect(p!.y).toBeLessThan(2);
      expect(Math.hypot(p!.x, p!.z)).toBeLessThan(2.6);
    }
    sim.free();
  });

  it("never leave a coin standing on its rim", async () => {
    for (let seed = 1; seed <= 12; seed++) {
      const sim = new PileSim(await loadRapier(), COIN, seeded(seed));
      sim.sync(8);
      settle(sim);
      for (let i = 0; i < sim.count; i++) {
        const o = new Object3D();
        sim.pose(i, o);
        // How far the coin's axis is from vertical: a coin lying flat, or leaning on another, stays below 60 degrees.
        const axis = new Vector3(0, 1, 0).applyQuaternion(o.quaternion);
        expect(Math.abs(axis.y)).toBeGreaterThan(0.5);
      }
      sim.free();
    }
  });

  it("let the rest settle when tokens are taken from the top", async () => {
    const sim = new PileSim(await loadRapier(), CRYSTAL, seeded(2));
    sim.sync(5);
    settle(sim);
    sim.sync(2);
    expect(sim.count).toBe(2);
    expect(sim.awake).toBe(true);
    settle(sim);
    for (const p of poses(sim)) expect(p!.y).toBeGreaterThan(-0.05);
    sim.free();
  });
});
