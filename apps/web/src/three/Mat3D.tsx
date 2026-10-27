import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useMemo, useRef } from "react";
import { AdditiveBlending, type MeshBasicMaterial } from "three";
import { MAT_TOP, type MatItem } from "./layout";
import { mix } from "./paint";
import { glowTexture, matTexture } from "./textures";

const noRaycast = () => null;

/** A seat's play mat (or the market board): a cloth slab with its printed top, glowing on its turn. */
export function Mat3D({ mat }: { mat: MatItem }) {
  const glow = useRef<MeshBasicMaterial>(null!);
  const { width, depth, color, title } = mat;
  const top = useMemo(() => matTexture(width, depth, color, title), [width, depth, color, title]);
  const halo = useMemo(() => glowTexture(width, depth, 2.4, 0.7), [width, depth]);
  useFrame((state, dt) => {
    const pulse = mat.active ? 0.5 + 0.18 * Math.sin(state.clock.elapsedTime * 2) : 0;
    easing.damp(glow.current, "opacity", pulse, 0.25, dt);
  });
  return (
    <group position={mat.position}>
      <RoundedBox args={[width, MAT_TOP, depth]} radius={0.14} smoothness={3} position={[0, MAT_TOP / 2, 0]} castShadow receiveShadow raycast={noRaycast}>
        <meshStandardMaterial color={mix(color, "#15161b", 0.82)} roughness={0.9} />
      </RoundedBox>
      <mesh rotation-x={-Math.PI / 2} position={[0, MAT_TOP + 0.004, 0]} receiveShadow raycast={noRaycast}>
        <planeGeometry args={[width - 0.04, depth - 0.04]} />
        <meshStandardMaterial map={top} roughness={0.92} transparent alphaTest={0.5} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} raycast={noRaycast}>
        <planeGeometry args={[width + 4.8, depth + 4.8]} />
        <meshBasicMaterial
          ref={glow}
          map={halo}
          color={color}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
