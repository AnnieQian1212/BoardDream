import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { CanvasTexture, Object3D, type InstancedMesh, type Sprite, type SpriteMaterial } from "three";
import { ChipPool, DUST_LIFE, MAX_CHIPS } from "./debris";
import { ROCK } from "./Grass";
import { reducedMotion } from "./motion";

let dustTexture: CanvasTexture | undefined;
/** A soft puff of warm brown-gray dust, drawn once and shared. */
function dustPuff(): CanvasTexture {
  if (dustTexture) return dustTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(150, 135, 112, 0.9)");
  gradient.addColorStop(0.5, "rgba(150, 135, 112, 0.35)");
  gradient.addColorStop(1, "rgba(150, 135, 112, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  dustTexture = new CanvasTexture(canvas);
  return dustTexture;
}

/**
 * The board's stone chips. `burst` takes a world point; `origin` is the board's position, since
 * the chips are drawn inside the board's group, and `ground` says where tiles lie in it.
 */
export function useChips(floor: number, low: number, scale: number, origin: [number, number, number], ground: (x: number, z: number) => boolean) {
  const invalidate = useThree((s) => s.invalidate);
  const pool = useMemo(() => new ChipPool(floor, scale, ground, low), [floor, scale, ground, low]);
  const burst = useCallback(
    (x: number, z: number) => {
      if (reducedMotion) return;
      pool.burst(x - origin[0], z - origin[2]);
      invalidate();
    },
    [pool, origin[0], origin[2], invalidate],
  );
  return { pool, burst };
}

export function Chips({ pool }: { pool: ChipPool }) {
  const mesh = useRef<InstancedMesh>(null);
  const puffs = useRef<(Sprite | null)[]>([]);
  const dummy = useMemo(() => new Object3D(), []);
  // Every slot starts empty.
  useLayoutEffect(() => {
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < MAX_CHIPS; i++) mesh.current?.setMatrixAt(i, dummy.matrix);
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);
  useFrame((state, delta) => {
    const chips = mesh.current;
    if (!chips || !pool.active) return;
    // The frame where the last chip goes still draws it gone.
    const moving = pool.step(Math.min(delta, 1 / 30));
    for (let i = 0; i < MAX_CHIPS; i++) {
      const size = pool.drawnSize(i);
      dummy.position.set(pool.x[i], pool.y[i], pool.z[i]);
      dummy.rotation.set(pool.spinX[i], pool.spinY[i], 0);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      chips.setMatrixAt(i, dummy.matrix);
    }
    chips.instanceMatrix.needsUpdate = true;
    pool.dust.forEach((d, i) => {
      const puff = puffs.current[i];
      if (!puff) return;
      puff.visible = Number.isFinite(d.age);
      if (!puff.visible) return;
      const t = d.age / DUST_LIFE;
      const size = pool.scale * (0.25 + 0.5 * Math.sqrt(t));
      puff.position.set(d.x, pool.floor + pool.scale * (0.05 + 0.12 * t), d.z);
      puff.scale.set(size, size * 0.7, 1);
      (puff.material as SpriteMaterial).opacity = 0.7 * (1 - t) ** 1.5;
    });
    if (moving) state.invalidate();
  });
  return (
    <>
      <instancedMesh ref={mesh} args={[ROCK, undefined, MAX_CHIPS]} raycast={noRaycast} frustumCulled={false} castShadow>
        {/* Darker than the boulders, so chips show against a pale quarry floor. */}
        <meshStandardMaterial vertexColors color="#b3ab9e" roughness={0.85} />
      </instancedMesh>
      {pool.dust.map((_, i) => (
        <sprite key={i} ref={(s) => void (puffs.current[i] = s)} visible={false} raycast={noRaycast} renderOrder={3}>
          <spriteMaterial map={dustPuff()} transparent depthWrite={false} opacity={0} />
        </sprite>
      ))}
    </>
  );
}

const noRaycast = () => null;
