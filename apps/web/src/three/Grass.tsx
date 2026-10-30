import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Object3D,
  Vector2,
  Vector4,
  type InstancedMesh,
  type MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { HIGHLIGHT } from "./Card3D";
import type { Sprout } from "./growth";
import { reducedMotion } from "./motion";
import { seeded } from "./paint";

/**
 * Low-poly grass, flowers and trees on green cells, drawn as instances. They sway in a gust that
 * rolls over the board after each move and part around the pointer, then hold still, so a quiet
 * table draws no frames for them.
 */

// ---------------------------------------------------------------------------------------------
// Shapes, one unit tall, standing on y = 0. Vertex colors carry the light from root to tip.

const tint = (hex: string) => new Color(hex);

/** A clump of nine blades leaning outward, darker at the root and sunlit at the tip. */
const CLUMP = (() => {
  const random = seeded(7);
  const [root, middle, tip] = [tint("#3f6d2a"), tint("#86ad3c"), tint("#d6dc69")];
  const positions: number[] = [];
  const colors: number[] = [];
  const vertex = (x: number, y: number, z: number, c: Color) => {
    positions.push(x, y, z);
    colors.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 + random() * 0.6;
    const [dx, dz] = [Math.cos(angle), Math.sin(angle)];
    const [ox, oz] = [dx * random() * 0.16, dz * random() * 0.16];
    const lean = 0.12 + random() * 0.25;
    const height = 0.7 + random() * 0.3;
    const width = 0.08 + random() * 0.04;
    // Across the blade, so it faces out from the clump's middle.
    const [wx, wz] = [-dz * width, dx * width];
    const at = (t: number, w: number) => [ox + dx * lean * t * t + wx * w, height * t, oz + dz * lean * t * t + wz * w] as const;
    const [bl, br, ml, mr, top] = [at(0, -1), at(0, 1), at(0.55, -0.6), at(0.55, 0.6), at(1, 0)];
    for (const [p, c] of [
      [bl, root],
      [br, root],
      [mr, middle],
      [bl, root],
      [mr, middle],
      [ml, middle],
      [ml, middle],
      [mr, middle],
      [top, tip],
    ] as const)
      vertex(p[0], p[1], p[2], c);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  // Every blade lit as if it faced the sky: the clump shades like the ground it covers.
  g.setAttribute("normal", new Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
})();

/** A small white flower with a yellow eye, on a stem a little taller than the grass. */
const FLOWER = (() => {
  const positions: number[] = [];
  const colors: number[] = [];
  const add = (points: number[][], c: Color) => {
    for (const p of points) positions.push(...p), colors.push(c.r, c.g, c.b);
  };
  const [stem, petal, eye] = [tint("#5d8a34"), tint("#f8f6ee"), tint("#f0c943")];
  add(
    [
      [-0.015, 0, 0],
      [0.015, 0, 0],
      [0.01, 1.05, 0],
      [-0.015, 0, 0],
      [0.01, 1.05, 0],
      [-0.01, 1.05, 0],
    ],
    stem,
  );
  const head = 1.07;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const [c, s, c2, s2] = [Math.cos(a - 0.45), Math.sin(a - 0.45), Math.cos(a + 0.45), Math.sin(a + 0.45)];
    add(
      [
        [0, head, 0],
        [c * 0.2, head + 0.01, s * 0.2],
        [c2 * 0.2, head + 0.01, s2 * 0.2],
      ],
      petal,
    );
  }
  for (let i = 0; i < 5; i++) {
    const [a, b] = [(i / 5) * Math.PI * 2, ((i + 1) / 5) * Math.PI * 2];
    add(
      [
        [0, head + 0.03, 0],
        [Math.cos(a) * 0.07, head + 0.025, Math.sin(a) * 0.07],
        [Math.cos(b) * 0.07, head + 0.025, Math.sin(b) * 0.07],
      ],
      eye,
    );
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  g.setAttribute("normal", new Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
})();

/** A low-poly pine: a short trunk under two stacked cones, faceted. */
const TREE = (() => {
  const positions: number[] = [];
  const colors: number[] = [];
  const sides = 6;
  const ring = (r: number, y: number, i: number) => [Math.cos((i / sides) * Math.PI * 2) * r, y, Math.sin((i / sides) * Math.PI * 2) * r];
  const cone = (r: number, y0: number, y1: number, low: Color, high: Color) => {
    for (let i = 0; i < sides; i++) {
      for (const p of [ring(r, y0, i + 1), ring(r, y0, i), [0, y1, 0]]) positions.push(...p);
      colors.push(low.r, low.g, low.b, low.r, low.g, low.b, high.r, high.g, high.b);
      for (const p of [ring(r, y0, i), ring(r, y0, i + 1), [0, y0, 0]]) positions.push(...p);
      for (let v = 0; v < 3; v++) colors.push(low.r * 0.7, low.g * 0.7, low.b * 0.7);
    }
  };
  const bark = tint("#7a5a3a");
  for (let i = 0; i < sides; i++) {
    const [a, b, c, d] = [ring(0.05, 0, i), ring(0.05, 0, i + 1), ring(0.05, 0.3, i + 1), ring(0.05, 0.3, i)];
    for (const p of [a, c, b, a, d, c]) positions.push(...p);
    for (let v = 0; v < 6; v++) colors.push(bark.r, bark.g, bark.b);
  }
  cone(0.32, 0.22, 0.74, tint("#3b6633"), tint("#5c8c43"));
  cone(0.24, 0.5, 1, tint("#4a7a3a"), tint("#77a352"));
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
})();

// ---------------------------------------------------------------------------------------------
// The board's wind and the pointer.

export interface GrassUniforms {
  uTime: { value: number };
  /** How hard the current gust blows, as a share of a blade's height. */
  uGust: { value: number };
  /** The pointer: world x and z, the reach of its push, and how far it bends what it reaches. */
  uPush: { value: Vector4 };
  /** The gust's direction, scaled so its waves are a few cells long. */
  uWind: { value: Vector2 };
}

export interface GrassField {
  uniforms: GrassUniforms;
  /** The pointer is over grass at this world point. */
  push(x: number, z: number): void;
  /** The pointer has left the grass. */
  release(): void;
}

/** How far the pointer bends the grass it reaches, as a share of a blade's height. */
const PUSH = 1.2;

/** A gust's strength over time: a quick rise, then a fade over a couple of seconds. */
const gust = (t: number) => (t < 0 ? 0 : t < 0.35 ? t / 0.35 : Math.exp(-(t - 0.35) * 2));

/**
 * The wind and the pointer's push for one board. `stir` changes (each move) start a gust. A board
 * with no grass (`growing` false) never draws a frame for it.
 */
export function useGrassField(k: number, cellSize: number, stir: unknown, growing: boolean): GrassField {
  const invalidate = useThree((s) => s.invalidate);
  const uniforms = useMemo<GrassUniforms>(
    () => ({
      uTime: { value: 0 },
      uGust: { value: 0 },
      uPush: { value: new Vector4(0, 0, 1, 0) },
      uWind: { value: new Vector2(1, 0.35).normalize().multiplyScalar((Math.PI * 2) / (cellSize * k * 3)) },
    }),
    [k, cellSize],
  );
  uniforms.uPush.value.z = cellSize * k * 0.22;
  const motion = useRef({ clock: 0, gustAt: -100, bend: 0, speed: 0, target: 0 });
  useEffect(() => {
    if (reducedMotion || !growing) return;
    motion.current.gustAt = motion.current.clock;
    invalidate();
  }, [stir, growing, invalidate]);
  const push = useCallback(
    (x: number, z: number) => {
      if (reducedMotion) return;
      uniforms.uPush.value.x = x;
      uniforms.uPush.value.y = z;
      motion.current.target = 1;
      invalidate();
    },
    [uniforms, invalidate],
  );
  const release = useCallback(() => {
    motion.current.target = 0;
    invalidate();
  }, [invalidate]);
  useFrame((_, delta) => {
    const m = motion.current;
    const dt = Math.min(delta, 1 / 30);
    const blowing = gust(m.clock - m.gustAt);
    // The push follows a spring, so released grass swings back past upright before it settles.
    const settled = Math.abs(m.bend - m.target) < 0.004 && Math.abs(m.speed) < 0.01;
    if (blowing < 0.004 && settled) {
      m.bend = m.target;
      m.speed = 0;
      uniforms.uGust.value = 0;
      uniforms.uPush.value.w = m.bend * PUSH;
      return;
    }
    m.clock += dt;
    m.speed += ((m.target - m.bend) * 110 - m.speed * 8) * dt;
    m.bend += m.speed * dt;
    uniforms.uTime.value = m.clock;
    uniforms.uGust.value = blowing * 0.22;
    uniforms.uPush.value.w = m.bend * PUSH;
    invalidate();
  });
  return useMemo(() => ({ uniforms, push, release }), [uniforms, push, release]);
}

// ---------------------------------------------------------------------------------------------
// The material: MeshStandardMaterial, bent in the vertex shader.

const VERTEX_DECLARATIONS = /* glsl */ `
uniform float uTime;
uniform float uGust;
uniform vec4 uPush;
uniform vec2 uWind;
uniform float uStiffness;
`;

// Replaces three's project_vertex: the same transform, with the instance bent before the view.
const BEND = /* glsl */ `
vec4 rootWorld = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float tall = (modelMatrix * instanceMatrix * vec4(0.0, 1.0, 0.0, 1.0)).y - rootWorld.y;
vec4 world = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
// Roots hold; the bend grows toward the tip.
float bend = position.y * position.y * tall * uStiffness;
// The gust leans everything one way, with waves rolling through and a little flutter.
float wave = sin(dot(rootWorld.xz, uWind) - uTime * 3.4);
float flutter = sin(uTime * 9.0 + rootWorld.x * 7.3 + rootWorld.z * 5.1);
vec2 lean = normalize(uWind) * (0.6 + 0.4 * wave + 0.25 * flutter) * uGust;
// The pointer parts the grass around it.
vec2 away = rootWorld.xz - uPush.xy;
float dist = length(away);
lean += away / max(dist, 1e-4) * (1.0 - smoothstep(0.0, uPush.z, dist)) * smoothstep(0.0, uPush.z * 0.12, dist) * uPush.w;
world.xz += lean * bend;
world.y -= dot(lean, lean) * bend * 0.5;
vec4 mvPosition = viewMatrix * world;
gl_Position = projectionMatrix * mvPosition;
`;

function swayCompiler(field: GrassField, stiffness: number) {
  return (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, field.uniforms, { uStiffness: { value: stiffness } });
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${VERTEX_DECLARATIONS}`).replace("#include <project_vertex>", BEND);
    // Grass and flowers are lit from above whichever side faces the camera.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      "#include <normal_fragment_begin>\n#ifdef SKY_LIT\nnormal = normalize(vNormal);\nnonPerturbedNormal = normal;\n#endif",
    );
  };
}

// ---------------------------------------------------------------------------------------------
// One cell's growth.

interface PatchProps {
  sprouts: Sprout[];
  trees: Sprout[];
  /** World units per board unit. */
  k: number;
  /** The clump spacing, in board units: clumps are drawn a little wider so they meet. */
  spacing: number;
  /** A typical cell's width, in board units: grass and trees are sized from it. */
  cellSize: number;
  /** Height of the tile's top above the patch's origin. */
  top: number;
  field: GrassField;
  /** The tile's own material: its glow when the cell is a legal choice shows on the grass too. */
  glow: RefObject<MeshStandardMaterial>;
}

/** Grass height as a share of a typical green cell's width. */
export const GRASS_HEIGHT = 0.1;

const MEADOW_TINTS = [tint("#fff3c4"), tint("#e4f5c9"), tint("#ffffff")];
const FOREST_TINTS = [tint("#8fb79a"), tint("#a3c497"), tint("#97b98a")];

export function GrassPatch({ sprouts, trees, k, spacing, cellSize, top, field, glow }: PatchProps) {
  const grass = useRef<InstancedMesh>(null);
  const flowers = useRef<InstancedMesh>(null);
  const forest = useRef<InstancedMesh>(null);
  const materials = useRef<(MeshStandardMaterial | null)[]>([]);
  // About one meadow clump in nine flowers (sprout turns are uniform over a full circle).
  const blooms = useMemo(() => sprouts.filter((s) => s.growth === "meadow" && s.turn < 0.7), [sprouts]);
  const compile = useMemo(() => ({ grass: swayCompiler(field, 1), tree: swayCompiler(field, 0.18) }), [field]);

  useLayoutEffect(() => {
    const dummy = new Object3D();
    const height = cellSize * GRASS_HEIGHT * k;
    const width = spacing * k * 1.8;
    const place = (mesh: InstancedMesh | null, list: Sprout[], size: (s: Sprout) => [number, number], color?: (s: Sprout, i: number) => Color) => {
      if (!mesh) return;
      list.forEach((s, i) => {
        const [w, h] = size(s);
        dummy.position.set(s.x * k, top, s.y * k);
        dummy.rotation.set(0, s.turn, 0);
        dummy.scale.set(w, h, w);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (color) mesh.setColorAt(i, color(s, i));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    const shade = new Color();
    place(grass.current, sprouts, (s) => [width * s.size, height * s.size * (s.growth === "forest" ? 1.15 : 1)], (s, i) => {
      const tints = s.growth === "forest" ? FOREST_TINTS : MEADOW_TINTS;
      return shade.copy(tints[i % 3]).lerp(tints[(i + 1) % 3], (s.size - 0.75) * 2);
    });
    place(flowers.current, blooms, (s) => [width * 0.9, height * (0.95 + s.size * 0.2)]);
    const tree = cellSize * 0.3 * k;
    place(forest.current, trees, (s) => [tree * s.size, tree * s.size], (_, i) => shade.copy(FOREST_TINTS[i % 3]).lerp(tint("#ffffff"), 0.55));
  }, [sprouts, trees, blooms, k, spacing, cellSize, top]);

  useFrame(() => {
    const intensity = glow.current?.emissiveIntensity ?? 0;
    for (const m of materials.current) if (m) m.emissiveIntensity = intensity * 0.6;
  });

  const material = (i: number, compiler: (shader: WebGLProgramParametersWithUniforms) => void, skyLit: boolean) => (
    <meshStandardMaterial
      ref={(m) => void (materials.current[i] = m)}
      vertexColors
      side={skyLit ? DoubleSide : undefined}
      roughness={0.9}
      emissive={HIGHLIGHT}
      emissiveIntensity={0}
      defines={skyLit ? { SKY_LIT: "" } : undefined}
      onBeforeCompile={compiler}
    />
  );
  return (
    <>
      {sprouts.length > 0 && (
        <instancedMesh key={`g${sprouts.length}`} ref={grass} args={[CLUMP, undefined, sprouts.length]} raycast={noRaycast} receiveShadow>
          {material(0, compile.grass, true)}
        </instancedMesh>
      )}
      {blooms.length > 0 && (
        <instancedMesh key={`f${blooms.length}`} ref={flowers} args={[FLOWER, undefined, blooms.length]} raycast={noRaycast}>
          {material(1, compile.grass, true)}
        </instancedMesh>
      )}
      {trees.length > 0 && (
        <instancedMesh key={`t${trees.length}`} ref={forest} args={[TREE, undefined, trees.length]} raycast={noRaycast} castShadow receiveShadow>
          {material(2, compile.tree, false)}
        </instancedMesh>
      )}
    </>
  );
}

const noRaycast = () => null;
