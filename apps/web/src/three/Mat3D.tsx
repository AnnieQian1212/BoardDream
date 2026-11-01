import { useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useMemo, useRef } from "react";
import type { MeshBasicMaterial } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { shadowGeometry } from "./Card3D";
import { Ink } from "./Ink";
import { MAT_TOP, type MatItem } from "./layout";
import { step } from "./motion";
import { mix } from "./paint";
import { glowTexture, KRAFT, matTexture } from "./textures";

const noRaycast = () => null;

/** A seat's play mat or a shared supply board, both printed card stock, with a halo on that seat's turn. */
export function Mat3D({ mat }: { mat: MatItem }) {
  const halo = useRef<MeshBasicMaterial>(null!);
  const invalidate = useThree((s) => s.invalidate);
  const { width, depth, color, title, shared } = mat;
  const top = useMemo(() => matTexture(width, depth, color, title, shared), [width, depth, color, title, shared]);
  const soft = useMemo(() => glowTexture(width, depth, 1.6, 0.7), [width, depth]);
  const shadow = useMemo(() => shadowGeometry(width, depth, 1.6), [width, depth]);
  useEffect(() => () => shadow.dispose(), [shadow]);
  const body = useMemo(() => new RoundedBoxGeometry(width, MAT_TOP, depth, 2, 0.14), [width, depth]);
  useEffect(() => () => body.dispose(), [body]);
  useEffect(() => invalidate(), [mat.active, invalidate]);
  useFrame((state, dt) => {
    if (easing.damp(halo.current, "opacity", mat.active ? 0.55 : 0, 0.25, step(dt))) state.invalidate();
  });
  const side = shared ? KRAFT : mix(color, KRAFT, 0.55);
  return (
    <group position={mat.position}>
      <mesh geometry={shadow} position={[0.5, 0.01, 0.7]} raycast={noRaycast} renderOrder={-3}>
        <meshBasicMaterial map={soft} color="#3a2410" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} raycast={noRaycast} renderOrder={-2}>
        <planeGeometry args={[width + 3.2, depth + 3.2]} />
        <meshBasicMaterial ref={halo} map={soft} color={color} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={body} position={[0, MAT_TOP / 2, 0]} receiveShadow raycast={noRaycast}>
        <meshStandardMaterial color={side} roughness={0.9} />
        <Ink geometry={body} width={2} grounded />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, MAT_TOP + 0.004, 0]} receiveShadow raycast={noRaycast}>
        <planeGeometry args={[width - 0.04, depth - 0.04]} />
        {/* Opaque with a cutout, so shadows and glows laid on the mat draw after it. */}
        <meshStandardMaterial map={top} roughness={0.92} alphaTest={0.5} />
      </mesh>
    </group>
  );
}
