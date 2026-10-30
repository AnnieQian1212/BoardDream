import type { ResourceSpec } from "@boarddream/engine";
import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { easing } from "maath";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Color, Object3D, PerspectiveCamera, Vector3, type DirectionalLight, type HemisphereLight } from "three";
import { Board3D, type BoardPaint } from "./Board3D";
import { fitCamera, FOV, type Insets } from "./camera";
import { Card3D, Deck3D } from "./Card3D";
import { LabelTracker } from "./Labels";
import type { CardItem, TableLayout, Vec3 } from "./layout";
import { Mat3D } from "./Mat3D";
import { step } from "./motion";
import { Pile3D } from "./Pile3D";
import type { Quality } from "./quality";
import { textureUpdates, woodTextures } from "./textures";

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
  quality: Quality;
  /** Painted board art, when the game has some. */
  boardPaint?: BoardPaint;
  /** Called when animation runs too slowly, to step the quality down. */
  onSlow?(): void;
  onPick(id: string, x: number, y: number): void;
}

/**
 * The table renders on demand: every animated object asks for another frame only while it is
 * still moving, so a settled table costs nothing.
 */
export function Scene({ layout, resources, targets, insets, labels, mover, quality, boardPaint, onSlow, onPick }: Props) {
  const leaving = useLeaving(layout, mover);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [layout, quality, invalidate]);
  useEffect(() => {
    const redraw = () => invalidate();
    textureUpdates.addEventListener("update", redraw);
    return () => textureUpdates.removeEventListener("update", redraw);
  }, [invalidate]);
  const { min, max } = layout.bounds;
  const center: Vec3 = [(min[0] + max[0]) / 2, 0, (min[2] + max[2]) / 2];
  const extent = Math.max(max[0] - min[0], max[2] - min[2]) / 2 + 12;
  return (
    <>
      <color attach="background" args={["#e6dac8"]} />
      <CameraRig layout={layout} insets={insets} />
      <FrameMonitor onSlow={onSlow} />
      <Lights center={center} extent={extent} quality={quality} night={layout.board?.geometry.mood === "night"} />
      <Environment resolution={128} environmentIntensity={0.5}>
        <Lightformer form="rect" intensity={2} color="#fffaf0" position={[-20, 60, 10]} rotation-x={Math.PI / 2} scale={[80, 50, 1]} />
        <Lightformer form="rect" intensity={1} color="#dfe8ff" position={[70, 25, -20]} rotation-y={-Math.PI / 2} scale={[60, 20, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#fff1dc" position={[0, 18, 80]} rotation-y={Math.PI} scale={[80, 16, 1]} />
      </Environment>
      <TableSurface center={center} />

      {layout.mats.map((mat) => (
        <Mat3D key={mat.id} mat={mat} />
      ))}
      <LabelTracker anchors={labels.anchors} layer={labels.layer} />
      {layout.board && <Board3D board={layout.board} targets={targets} paint={boardPaint} glowLights={quality.glowLights} grass={quality.grass} onPick={onPick} />}
      {layout.decks.map((deck) => (
        <Deck3D key={deck.id} item={deck} onPick={onPick} />
      ))}
      {layout.piles.map((pile) => (
        <Pile3D key={pile.id} pile={pile} onPick={onPick} />
      ))}
      {[...layout.cards, ...leaving].map((card) => (
        <Card3D key={card.id} item={card} resources={resources} onPick={onPick} />
      ))}

      {quality.ambientOcclusion && (
        <EffectComposer multisampling={4}>
          <N8AO aoRadius={2.5} distanceFalloff={0.6} intensity={1.2} quality="medium" halfRes />
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
      // It shrinks to nothing on the way, so it never comes to rest on the mat's title.
      gone.current.set(c.id, { item: { ...c, position, scale: 0.02, target: false }, until: performance.now() + 650 });
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

/** Watches frame times while something animates and reports when they stay above ~33 ms. */
function FrameMonitor({ onSlow }: { onSlow?(): void }) {
  const samples = useRef<number[]>([]);
  useFrame((_, dt) => {
    if (!onSlow) return;
    // A long gap means the table was idle between on-demand frames; start over.
    if (dt > 0.25) {
      samples.current = [];
      return;
    }
    samples.current.push(dt);
    if (samples.current.length < 40) return;
    const median = [...samples.current].sort((a, b) => a - b)[20];
    samples.current = [];
    if (median > 1 / 30) onSlow();
  });
  return null;
}

/** The light over the table by day, and the cool dusk a game's night brings (Geometry.mood). */
const DAY = {
  sky: new Color("#fffaf0"),
  ground: new Color("#c9ae8c"),
  hemi: 1.15,
  key: new Color("#fff3e0"),
  keyIntensity: 1.9,
  fill: 0.4,
  environment: 0.5,
  background: new Color("#e6dac8"),
};
const NIGHT = {
  sky: new Color("#aebee6"),
  ground: new Color("#4d4766"),
  hemi: 0.5,
  key: new Color("#a9b9ff"),
  keyIntensity: 0.55,
  fill: 0.25,
  environment: 0.2,
  background: new Color("#b4bccd"),
};

/**
 * Sky light, a key light that casts the shadows, and a cool fill. Day and night blend over about
 * a second, drawing frames only while they do.
 */
function Lights({ center, extent, quality, night }: { center: Vec3; extent: number; quality: Quality; night: boolean }) {
  const target = useMemo(() => new Object3D(), []);
  const [x, , z] = center;
  const hemi = useRef<HemisphereLight>(null!);
  const key = useRef<DirectionalLight>(null!);
  const fill = useRef<DirectionalLight>(null!);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [night, invalidate]);
  useFrame((_, delta) => {
    const dt = step(delta);
    const look = night ? NIGHT : DAY;
    let moving = easing.damp(hemi.current, "intensity", look.hemi, 0.35, dt);
    moving = easing.dampC(hemi.current.color, look.sky, 0.35, dt) || moving;
    moving = easing.dampC(hemi.current.groundColor, look.ground, 0.35, dt) || moving;
    moving = easing.damp(key.current, "intensity", look.keyIntensity, 0.35, dt) || moving;
    moving = easing.dampC(key.current.color, look.key, 0.35, dt) || moving;
    moving = easing.damp(fill.current, "intensity", look.fill, 0.35, dt) || moving;
    moving = easing.damp(scene, "environmentIntensity", look.environment, 0.35, dt) || moving;
    if (scene.background instanceof Color) moving = easing.dampC(scene.background, look.background, 0.35, dt) || moving;
    if (moving) invalidate();
  });
  return (
    <>
      <primitive object={target} position={center} />
      <hemisphereLight ref={hemi} args={["#fffaf0", "#c9ae8c", 1.15]} />
      <directionalLight
        ref={key}
        target={target}
        position={[x - 45, 90, z + 35]}
        intensity={1.9}
        color="#fff3e0"
        castShadow={quality.shadows}
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
        shadow-radius={4}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={20}
        shadow-camera-far={260}
      />
      <directionalLight ref={fill} position={[x + 60, 40, z - 40]} intensity={0.4} color="#dce6ff" />
    </>
  );
}

function TableSurface({ center }: { center: Vec3 }) {
  const { map, bump } = woodTextures();
  return (
    <mesh rotation-x={-Math.PI / 2} position={[center[0], 0, center[2]]} receiveShadow raycast={() => null}>
      <planeGeometry args={[420, 420]} />
      <meshStandardMaterial map={map} bumpMap={bump} bumpScale={0.4} roughness={0.62} envMapIntensity={0.4} />
    </mesh>
  );
}

function CameraRig({ layout, insets }: { layout: TableLayout; insets: Insets }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);
  const goal = useMemo(() => fitCamera(layout, width, height, insets), [layout, width, height, insets]);
  const look = useRef<Vector3 | null>(null);

  useEffect(() => {
    camera.fov = FOV;
    camera.near = 5;
    camera.far = 1500;
    camera.setViewOffset(width, height, -(insets.left - insets.right) / 2, -(insets.top - insets.bottom) / 2, width, height);
    camera.updateProjectionMatrix();
  }, [camera, width, height, insets]);

  useFrame((state, delta) => {
    const dt = step(delta);
    if (!look.current) {
      // First frame: start a little higher and swoop in.
      look.current = goal.target.clone();
      camera.position.copy(goal.position).add(new Vector3(0, 40, 30));
    }
    let moving = easing.damp3(camera.position, goal.position, 0.6, dt, Infinity, undefined, 0.01);
    moving = easing.damp3(look.current, goal.target, 0.6, dt, Infinity, undefined, 0.01) || moving;
    camera.lookAt(look.current);
    if (moving) state.invalidate();
  });
  return null;
}
