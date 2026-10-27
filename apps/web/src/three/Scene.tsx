import type { ResourceSpec } from "@boarddream/engine";
import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { easing } from "maath";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Object3D, PerspectiveCamera, Vector3 } from "three";
import { Board3D } from "./Board3D";
import { fitCamera, FOV, type Insets } from "./camera";
import { Card3D, Deck3D } from "./Card3D";
import type { CardItem, TableLayout, Vec3 } from "./layout";
import { LabelTracker } from "./Labels";
import { Mat3D } from "./Mat3D";
import { Pile3D } from "./Pile3D";
import { woodTextures } from "./textures";

export type { Insets } from "./camera";

interface Props {
  layout: TableLayout;
  resources: Map<string, ResourceSpec>;
  targets: Set<string>;
  insets: Insets;
  /** HTML labels (scores, counts) and the table points they follow. */
  labels: { anchors: Map<string, Vec3>; layer: RefObject<HTMLDivElement | null> };
  /** Seat that made the last move: cards leaving the table fly to their mat. */
  mover?: number;
  effects: boolean;
  onPick(id: string, x: number, y: number): void;
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Scene({ layout, resources, targets, insets, labels, mover, effects, onPick }: Props) {
  const leaving = useLeaving(layout, mover);
  const { min, max } = layout.bounds;
  const center: Vec3 = [(min[0] + max[0]) / 2, 0, (min[2] + max[2]) / 2];
  return (
    <>
      <color attach="background" args={["#0d0907"]} />
      <CameraRig layout={layout} insets={insets} />
      <Lights center={center} />
      <Environment resolution={256} environmentIntensity={0.45}>
        <Lightformer form="rect" intensity={2.2} color="#fff1dc" position={[-20, 60, 10]} rotation-x={Math.PI / 2} scale={[80, 50, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#b9cdf5" position={[70, 25, -20]} rotation-y={-Math.PI / 2} scale={[60, 20, 1]} />
        <Lightformer form="rect" intensity={0.7} color="#ffd59a" position={[0, 18, 80]} rotation-y={Math.PI} scale={[80, 16, 1]} />
      </Environment>
      <TableSurface center={center} />

      {layout.mats.map((mat) => (
        <Mat3D key={mat.id} mat={mat} />
      ))}
      <LabelTracker anchors={labels.anchors} layer={labels.layer} />
      {layout.board && <Board3D board={layout.board} targets={targets} onPick={onPick} />}
      {layout.decks.map((deck) => (
        <Deck3D key={deck.id} item={deck} onPick={onPick} />
      ))}
      {layout.piles.map((pile) => (
        <Pile3D key={pile.id} pile={pile} onPick={onPick} />
      ))}
      {[...layout.cards, ...leaving].map((card) => (
        <Card3D key={card.id} item={card} resources={resources} onPick={onPick} />
      ))}

      {effects && (
        <EffectComposer multisampling={4}>
          <N8AO aoRadius={2.5} distanceFalloff={0.6} intensity={1.6} quality="medium" halfRes />
          <Bloom mipmapBlur intensity={0.5} luminanceThreshold={0.85} luminanceSmoothing={0.25} />
          <Vignette offset={0.28} darkness={0.62} />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        </EffectComposer>
      )}
    </>
  );
}

/**
 * Cards that left the table this move keep flying for a moment: to the mover's mat, or up and away.
 * Worked out during render so a leaving card keeps its mesh (same key) and never jumps.
 */
function useLeaving(layout: TableLayout, mover: number | undefined): CardItem[] {
  const last = useRef<TableLayout | null>(null);
  const gone = useRef(new Map<string, { item: CardItem; until: number }>());
  const [, rerender] = useState(0);
  if (last.current !== layout) {
    const ids = new Set(layout.cards.map((c) => c.id));
    for (const id of gone.current.keys()) if (ids.has(id)) gone.current.delete(id);
    const exit = mover !== undefined ? layout.seatAnchors.get(mover) : undefined;
    for (const c of last.current?.cards ?? []) {
      if (ids.has(c.id)) continue;
      const position: Vec3 = exit ?? [c.position[0], c.position[1] + 8, c.position[2]];
      gone.current.set(c.id, { item: { ...c, position, scale: 0.3, target: false }, until: performance.now() + 650 });
    }
    last.current = layout;
  }
  useEffect(() => {
    if (gone.current.size === 0) return;
    const timer = setTimeout(() => {
      const now = performance.now();
      for (const [id, g] of gone.current) if (g.until <= now) gone.current.delete(id);
      rerender((n) => n + 1);
    }, 700);
    return () => clearTimeout(timer);
  }, [layout]);
  return [...gone.current.values()].map((g) => g.item);
}

function Lights({ center }: { center: Vec3 }) {
  const target = useMemo(() => new Object3D(), []);
  const [x, , z] = center;
  return (
    <>
      <primitive object={target} position={center} />
      <hemisphereLight args={["#ffe8c8", "#2a1a10", 0.45]} />
      <spotLight
        target={target}
        position={[x - 42, 115, z + 30]}
        angle={0.56}
        penumbra={0.9}
        decay={0}
        intensity={3.4}
        color="#ffe3bd"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
        shadow-radius={5}
        shadow-camera-near={40}
        shadow-camera-far={320}
      />
      <directionalLight position={[x + 60, 40, z - 50]} intensity={0.55} color="#9fb8ef" />
    </>
  );
}

function TableSurface({ center }: { center: Vec3 }) {
  const { map, bump } = woodTextures();
  return (
    <mesh rotation-x={-Math.PI / 2} position={[center[0], 0, center[2]]} receiveShadow raycast={() => null}>
      <planeGeometry args={[420, 420]} />
      <meshPhysicalMaterial map={map} bumpMap={bump} bumpScale={0.6} roughness={0.55} clearcoat={0.3} clearcoatRoughness={0.4} />
    </mesh>
  );
}

function CameraRig({ layout, insets }: { layout: TableLayout; insets: Insets }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);
  const goal = useMemo(() => fitCamera(layout, width, height, insets), [layout, width, height, insets]);
  const look = useRef<Vector3 | null>(null);
  const aim = useMemo(() => new Vector3(), []);

  useEffect(() => {
    camera.fov = FOV;
    camera.setViewOffset(width, height, -(insets.left - insets.right) / 2, -(insets.top - insets.bottom) / 2, width, height);
    camera.updateProjectionMatrix();
  }, [camera, width, height, insets]);

  useFrame((state, dt) => {
    if (!look.current) {
      // First frame: start a little higher and swoop in.
      look.current = goal.target.clone();
      camera.position.copy(goal.position).add(new Vector3(0, 40, 30));
    }
    const t = state.clock.elapsedTime;
    // A slow drift and a little parallax from the pointer keep the table feeling physical.
    aim.copy(goal.position);
    if (!reducedMotion) aim.add({ x: state.pointer.x * 2.2 + Math.sin(t * 0.13) * 1.2, y: state.pointer.y * 1.2, z: Math.cos(t * 0.11) });
    easing.damp3(camera.position, aim, 0.9, dt);
    easing.damp3(look.current, goal.target, 0.9, dt);
    camera.lookAt(look.current);
  });
  return null;
}
