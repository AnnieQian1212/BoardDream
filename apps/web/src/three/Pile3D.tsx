import { useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CylinderGeometry,
  Euler,
  OctahedronGeometry,
  SphereGeometry,
  type BufferGeometry,
  type Group,
  type Mesh,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { setCursor, setHover } from "./hover";
import type { PileItem } from "./layout";
import { step } from "./motion";
import { hash, seeded } from "./paint";
import { loadRapier, PileSim, type TokenFeel } from "./physics";
import { blobTexture, ringTexture } from "./textures";
import { HIGHLIGHT } from "./Card3D";

type TokenShape = "bead" | "crystal" | "block" | "coin" | "disc";

/** Resource icons map to a token shape, so a generated game's resources still look like components. */
const SHAPES: Record<string, TokenShape> = {
  droplet: "bead",
  fish: "bead",
  egg: "bead",
  heart: "bead",
  cloud: "bead",
  sun: "crystal",
  gem: "crystal",
  zap: "crystal",
  star: "crystal",
  flame: "crystal",
  coins: "coin",
  crown: "coin",
  shield: "coin",
  anchor: "coin",
  wheat: "disc",
  tree: "disc",
  trees: "disc",
  leaf: "disc",
  sprout: "disc",
  flower: "disc",
  feather: "disc",
};

const GEOMETRY: Record<TokenShape, BufferGeometry> = {
  bead: new SphereGeometry(0.75, 32, 20).scale(1, 0.78, 1).translate(0, 0.58, 0),
  crystal: new OctahedronGeometry(0.78).scale(0.9, 1.3, 0.9).translate(0, 1, 0),
  block: new RoundedBoxGeometry(1.25, 1.25, 1.25, 2, 0.18).translate(0, 0.62, 0),
  coin: new CylinderGeometry(0.82, 0.82, 0.28, 40).translate(0, 0.14, 0),
  disc: new CylinderGeometry(0.75, 0.75, 0.52, 32).translate(0, 0.26, 0),
};

/** How each shape lands: coins and beads skitter and bounce, wooden discs and blocks thud. */
const FEEL: Record<TokenShape, TokenFeel> = {
  bead: { geometry: GEOMETRY.bead, friction: 0.4, restitution: 0.35 },
  crystal: { geometry: GEOMETRY.crystal, friction: 0.5, restitution: 0.25 },
  block: { geometry: GEOMETRY.block, friction: 0.7, restitution: 0.15 },
  coin: { geometry: GEOMETRY.coin, friction: 0.45, restitution: 0.3, cylinder: { radius: 0.82, height: 0.28 } },
  disc: { geometry: GEOMETRY.disc, friction: 0.7, restitution: 0.15, cylinder: { radius: 0.75, height: 0.52 } },
};

/** Resting height of the next layer per shape, for stacking. */
const LAYER: Record<TokenShape, number> = { bead: 1.05, crystal: 1.55, block: 1.25, coin: 0.28, disc: 0.52 };

/** Up to ten slots: a ring of seven on the mat and three on top. */
const SLOTS: [number, number, number][] = [
  [0, 0, 0],
  ...Array.from({ length: 6 }, (_, i): [number, number, number] => [1.5 * Math.cos((i * Math.PI) / 3 + 0.3), 0, 1.5 * Math.sin((i * Math.PI) / 3 + 0.3)]),
  ...Array.from({ length: 3 }, (_, i): [number, number, number] => [0.8 * Math.cos((i * 2 * Math.PI) / 3), 1, 0.8 * Math.sin((i * 2 * Math.PI) / 3)]),
];
const MAX_SHOWN = SLOTS.length;
const noRaycast = () => null;

function Material({ shape, color }: { shape: TokenShape; color: string }) {
  switch (shape) {
    case "bead":
      return <meshStandardMaterial color={color} roughness={0.12} metalness={0.05} />;
    case "crystal":
      return <meshStandardMaterial color={color} roughness={0.2} flatShading emissive={color} emissiveIntensity={0.15} />;
    case "coin":
      return <meshStandardMaterial color={color} roughness={0.3} metalness={0.75} />;
    default:
      return <meshStandardMaterial color={color} roughness={0.72} />;
  }
}

function Token({ shape, color, slot, seed }: { shape: TokenShape; color: string; slot: number; seed: number }) {
  const ref = useRef<Group>(null!);
  const invalidate = useThree((s) => s.invalidate);
  const [x, layer, z] = SLOTS[slot];
  const rest = useMemo(() => {
    const rand = seeded(seed);
    return {
      y: layer * LAYER[shape],
      rotation: new Euler(shape === "block" ? (rand() - 0.5) * 0.1 : 0, rand() * Math.PI * 2, 0),
      jitter: [(rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12] as const,
    };
  }, [seed, layer, shape]);
  // New tokens drop in from above.
  useLayoutEffect(() => {
    ref.current.position.set(x + rest.jitter[0], rest.y + 5, z + rest.jitter[1]);
    invalidate();
  }, [x, z, rest, invalidate]);
  useFrame((state, dt) => {
    if (easing.damp(ref.current.position, "y", rest.y, 0.12, step(dt))) state.invalidate();
  });
  return (
    <group ref={ref} rotation={rest.rotation}>
      <mesh geometry={GEOMETRY[shape]} castShadow receiveShadow>
        <Material shape={shape} color={color} />
      </mesh>
    </group>
  );
}

/** Rapier once it has loaded, when the heap uses physics; undefined before, or if it fails to load. */
function useRapier(enabled: boolean) {
  const [rapier, setRapier] = useState<Awaited<ReturnType<typeof loadRapier>>>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadRapier().then(
      (r) => alive && setRapier(r),
      () => alive && setFailed(true),
    );
    return () => void (alive = false);
  }, [enabled]);
  return { rapier: enabled ? rapier : undefined, failed };
}

/** Tokens that fall on to the heap and tumble into place (physics.ts). */
function PhysicsTokens({ rapier, shape, color, count, seed }: { rapier: NonNullable<ReturnType<typeof useRapier>["rapier"]>; shape: TokenShape; color: string; count: number; seed: number }) {
  const invalidate = useThree((s) => s.invalidate);
  const sim = useRef<PileSim>(undefined);
  const meshes = useRef<(Mesh | null)[]>([]);
  const counted = useRef(count);
  counted.current = count;
  // The world lives with the heap; created in an effect so it is freed exactly once.
  useEffect(() => {
    const world = new PileSim(rapier, FEEL[shape], seeded(seed));
    world.sync(counted.current);
    sim.current = world;
    invalidate();
    return () => {
      sim.current = undefined;
      world.free();
    };
  }, [rapier, shape, seed, invalidate]);
  useEffect(() => {
    sim.current?.sync(count);
    invalidate();
  }, [count, invalidate]);
  useFrame((state, delta) => {
    const world = sim.current;
    if (!world?.awake) return;
    world.step(delta);
    meshes.current.forEach((mesh, i) => {
      if (mesh) mesh.visible = world.pose(i, mesh);
    });
    state.invalidate();
  });
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} ref={(m) => void (meshes.current[i] = m)} geometry={GEOMETRY[shape]} visible={false} castShadow receiveShadow>
          <Material shape={shape} color={color} />
        </mesh>
      ))}
    </>
  );
}

/**
 * A heap of resource tokens with a count chip; clickable when gathering it is a legal move. With
 * `physics`, tokens fall and tumble with Rapier; otherwise (lowest quality, reduced motion) they
 * drop straight into fixed places.
 */
export function Pile3D({ pile, physics, onPick }: { pile: PileItem; physics: boolean; onPick(id: string, x: number, y: number): void }) {
  const shape = SHAPES[pile.resource?.icon ?? ""] ?? "block";
  const color = pile.resource?.color ?? "#9a8f80";
  const value = pile.counter.value;
  const seed = hash(pile.id);
  const spread = 1.6 + Math.min(value, 7) * 0.16;
  const { rapier, failed } = useRapier(physics);
  const shown = Math.min(value, MAX_SHOWN);
  return (
    <group
      position={pile.position}
      scale={pile.scale}
      onPointerOver={(e) => {
        e.stopPropagation();
        setCursor(pile.target);
        setHover({ text: `${pile.counter.label}: ${value}`, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
      }}
      onPointerOut={() => {
        setCursor(false);
        setHover(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (pile.target) onPick(pile.id, e.nativeEvent.clientX, e.nativeEvent.clientY);
      }}
    >
      {rapier ? (
        <PhysicsTokens rapier={rapier} shape={shape} color={color} count={shown} seed={seed} />
      ) : (
        // While Rapier loads the heap waits, so tokens do not jump when it arrives.
        (!physics || failed) && Array.from({ length: shown }, (_, i) => <Token key={i} shape={shape} color={color} slot={i} seed={seed + i} />)
      )}
      {/* Soft contact shadow, hit area and target ring. */}
      {value > 0 && (
        <mesh rotation-x={-Math.PI / 2} position={[0.2, 0.012, 0.3]} raycast={noRaycast} renderOrder={-2}>
          <planeGeometry args={[2 * spread, 2 * spread]} />
          <meshBasicMaterial map={blobTexture()} color="#2a1a0c" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <circleGeometry args={[2.4, 24]} />
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
      </mesh>
      {pile.target && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]} raycast={noRaycast}>
          <planeGeometry args={[6.4, 6.4]} />
          <meshBasicMaterial map={ringTexture()} color={HIGHLIGHT} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
