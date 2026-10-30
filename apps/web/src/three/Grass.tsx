import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Object3D,
  Vector2,
  Vector4,
  type InstancedMesh,
  type MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { HIGHLIGHT } from "./Card3D";
import { HEIGHT, type Sprout } from "./growth";
import { reducedMotion } from "./motion";
import { seeded } from "./paint";

/**
 * Low-poly grass, flowers, trees, wheat and rocks on growing cells, drawn as instances. Plants sway
 * in a gust that rolls over the board after each move and part around the pointer, and rocks
 * glitter where the pointer passes; then everything holds still, so a quiet table draws no frames
 * for them.
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

/** A small flower on a stem a little taller than the grass: five petals round an eye. */
function flower(stem: Color, petal: Color, eye: Color, radius: number): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const add = (points: number[][], c: Color) => {
    for (const p of points) positions.push(...p), colors.push(c.r, c.g, c.b);
  };
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
        [c * radius, head + 0.01, s * radius],
        [c2 * radius, head + 0.01, s2 * radius],
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
}

/** A white meadow flower with a yellow eye. */
const FLOWER = flower(tint("#5d8a34"), tint("#f8f6ee"), tint("#f0c943"), 0.2);
/** A red poppy with a dark eye, standing among the wheat. */
const POPPY = flower(tint("#6b8a3a"), tint("#d8432f"), tint("#2a1d1a"), 0.17);

/**
 * A clump of nine wheat stalks, nearly upright: a thin stem, and a plump ear made of two crossed
 * diamonds so it has body from every side, amber at its base and pale at its tip.
 */
const WHEAT = (() => {
  const random = seeded(13);
  const [root, stalk, ear, tip] = [tint("#7f6a2c"), tint("#b8953f"), tint("#c98f2e"), tint("#fbe7a1")];
  const positions: number[] = [];
  const colors: number[] = [];
  const triangle = (points: (readonly number[])[], shades: Color[]) => {
    points.forEach((p, i) => {
      positions.push(p[0], p[1], p[2]);
      colors.push(shades[i].r, shades[i].g, shades[i].b);
    });
  };
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 + random() * 0.7;
    const [dx, dz] = [Math.cos(angle), Math.sin(angle)];
    const [ox, oz] = [dx * random() * 0.25, dz * random() * 0.25];
    const lean = 0.04 + random() * 0.08;
    const height = 0.78 + random() * 0.22;
    const at = (t: number, ax: number, az: number) => [ox + dx * lean * t + ax, height * t, oz + dz * lean * t + az] as const;
    // The stem, edge on to the clump's middle.
    const [sx, sz] = [-dz * 0.026, dx * 0.026];
    triangle([at(0, -sx, -sz), at(0, sx, sz), at(0.62, 0, 0)], [root, root, stalk]);
    // The ear: two diamonds at right angles, widest a third of the way up.
    for (const [wx, wz] of [
      [-dz * 0.085, dx * 0.085],
      [dx * 0.085, dz * 0.085],
    ]) {
      const [low, mid1, mid2, top] = [at(0.56, 0, 0), at(0.72, wx, wz), at(0.72, -wx, -wz), at(1, 0, 0)];
      triangle([low, mid1, top], [ear, ear, tip]);
      triangle([low, top, mid2], [ear, tip, ear]);
    }
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

/**
 * A faceted rock one unit across and about half as tall, sunk a little into the ground: a lumpy
 * icosahedron with a flat color per face, lighter on top, with moss on some upward faces.
 */
export const ROCK = (() => {
  const random = seeded(29);
  const g = new IcosahedronGeometry(0.5, 0).toNonIndexed();
  const pos = g.attributes.position;
  // Each corner moves the same way in every face it belongs to, so the rock stays closed.
  const lumps = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = [pos.getX(i), pos.getY(i), pos.getZ(i)].map((v) => v.toFixed(3)).join();
    if (!lumps.has(key)) lumps.set(key, 0.8 + random() * 0.35);
    const lump = lumps.get(key)!;
    pos.setXYZ(i, pos.getX(i) * lump, pos.getY(i) * lump * 0.72 + 0.12, pos.getZ(i) * lump);
  }
  g.computeVertexNormals();
  const normal = g.attributes.normal;
  const colors: number[] = [];
  const [dark, light, moss] = [tint("#7f7d77"), tint("#bdb9ae"), tint("#8f9a62")];
  const shade = new Color();
  for (let face = 0; face < pos.count / 3; face++) {
    const up = normal.getY(face * 3);
    shade.copy(dark).lerp(light, Math.min(1, Math.max(0, 0.35 + up * 0.5 + (random() - 0.5) * 0.3)));
    if (up > 0.75 && random() < 0.35) shade.lerp(moss, 0.7);
    for (let v = 0; v < 3; v++) colors.push(shade.r, shade.g, shade.b);
  }
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
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
#ifdef GLITTER
varying vec3 vGrassWorld;
#endif
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
#ifdef GLITTER
vGrassWorld = world.xyz;
#endif
vec4 mvPosition = viewMatrix * world;
gl_Position = projectionMatrix * mvPosition;
`;

const FRAGMENT_DECLARATIONS = /* glsl */ `
#ifdef GLITTER
uniform vec4 uPush;
uniform float uFleck;
varying vec3 vGrassWorld;
float fleckHash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
#endif
`;

// Rocks hold mica: tiny flecks, each facing its own way, that flash as the pointer passes over
// them like a lamp, and the stone's faces warm a little toward it.
const GLITTER = /* glsl */ `
#ifdef GLITTER
{
  float near = 1.0 - smoothstep(0.0, uPush.z * 1.5, distance(vGrassWorld.xz, uPush.xy));
  float lit = smoothstep(0.0, 0.5, uPush.w) * near;
  if (lit > 0.0) {
    vec3 lamp = vec3(uPush.x, vGrassWorld.y + uPush.z, uPush.y);
    vec3 toLamp = normalize(lamp - vGrassWorld);
    vec3 toEye = normalize(cameraPosition - vGrassWorld);
    vec3 fleck = floor(vGrassWorld * uFleck);
    vec3 facing = normalize(vec3(fleckHash(fleck + 1.7), fleckHash(fleck + 3.1), fleckHash(fleck + 5.3)) * 2.0 - 1.0 + vec3(0.0, 1.2, 0.0));
    float spark = pow(max(dot(facing, normalize(toLamp + toEye)), 0.0), 24.0) * step(0.75, fleckHash(fleck));
    vec3 worldNormal = transformNormalByInverseViewMatrix(normal, viewMatrix);
    totalEmissiveRadiance += vec3(1.0, 0.95, 0.82) * lit * (spark * 3.0 + 0.12 * max(dot(worldNormal, toLamp), 0.0));
  }
}
#endif
`;

/** `fleck` is the size of a rock's glittering flecks, in world units (rocks only). */
function swayCompiler(field: GrassField, stiffness: number, fleck = 1) {
  return (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, field.uniforms, { uStiffness: { value: stiffness }, uFleck: { value: 1 / fleck } });
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${VERTEX_DECLARATIONS}`).replace("#include <project_vertex>", BEND);
    // Grass and flowers are lit from above whichever side faces the camera.
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_DECLARATIONS}`)
      .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\n#ifdef SKY_LIT\nnormal = normalize(vNormal);\nnonPerturbedNormal = normal;\n#endif")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${GLITTER}`);
  };
}

/**
 * Makes a stony tile's own surface glitter under the pointer like the rocks on it. The material
 * needs the GLITTER define; `fleck` is the flecks' size in world units.
 */
export function glitterCompiler(field: GrassField, fleck: number) {
  return (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, { uPush: field.uniforms.uPush, uFleck: { value: 1 / fleck } });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGrassWorld;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvGrassWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_DECLARATIONS}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${GLITTER}`);
  };
}

// ---------------------------------------------------------------------------------------------
// One cell's growth.

interface PatchProps {
  /** Clumps of grass and wheat, and stones on stony ground. */
  sprouts: Sprout[];
  /** Trees in a forest and boulders on stony ground. */
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
  /** The tile's own material: its glow (a legal choice, or a light) shows on what grows there too. */
  glow: RefObject<MeshStandardMaterial>;
}

/** Grass height as a share of a typical green cell's width. */
export const GRASS_HEIGHT = 0.1;

const MEADOW_TINTS = [tint("#fff3c4"), tint("#e4f5c9"), tint("#ffffff")];
const FOREST_TINTS = [tint("#8fb79a"), tint("#a3c497"), tint("#97b98a")];
/** Wiry, sun-dried tufts between stones. */
const ROCK_TINTS = [tint("#f2d58a"), tint("#e6cf96"), tint("#f6e0a0")];
const WHEAT_TINTS = [tint("#fff6dc"), tint("#ffe9b8"), tint("#ffffff")];
const STONE_TINTS = [tint("#ffffff"), tint("#efebe2"), tint("#e2e2dc")];

/**
 * On stony ground only some sprouts grow anything: about one in seven is a stone and one in eight
 * a tuft of grass (sprout turns are uniform over a full circle).
 */
const isStone = (s: Sprout) => s.growth === "rock" && s.turn < 0.9;
const isTuft = (s: Sprout) => s.growth === "rock" && s.turn >= 0.9 && s.turn < 1.7;

export function GrassPatch({ sprouts, trees, k, spacing, cellSize, top, field, glow }: PatchProps) {
  const grass = useRef<InstancedMesh>(null);
  const flowers = useRef<InstancedMesh>(null);
  const wheat = useRef<InstancedMesh>(null);
  const poppies = useRef<InstancedMesh>(null);
  const forest = useRef<InstancedMesh>(null);
  const stones = useRef<InstancedMesh>(null);
  const materials = useRef<(MeshStandardMaterial | null)[]>([]);
  const groups = useMemo(
    () => ({
      clumps: sprouts.filter((s) => s.growth === "meadow" || s.growth === "forest" || isTuft(s)),
      wheat: sprouts.filter((s) => s.growth === "field"),
      // About one meadow clump in nine flowers, and one wheat clump in sixteen hides a poppy.
      blooms: sprouts.filter((s) => s.growth === "meadow" && s.turn < 0.7),
      poppies: sprouts.filter((s) => s.growth === "field" && s.turn < 0.4),
      pines: trees.filter((s) => s.growth === "forest"),
      rocks: [...trees.filter((s) => s.growth === "rock").map((s) => ({ ...s, boulder: true })), ...sprouts.filter(isStone).map((s) => ({ ...s, boulder: false }))],
    }),
    [sprouts, trees],
  );
  const compile = useMemo(
    () => ({ grass: swayCompiler(field, 1), tree: swayCompiler(field, 0.18), rock: swayCompiler(field, 0, cellSize * k * 0.02) }),
    [field, cellSize, k],
  );

  useLayoutEffect(() => {
    const dummy = new Object3D();
    const height = cellSize * GRASS_HEIGHT * k;
    const width = spacing * k * 1.8;
    const place = <S extends Sprout>(mesh: InstancedMesh | null, list: S[], size: (s: S) => [number, number], color?: (s: S, i: number) => Color) => {
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
    const blend = (tints: Color[], s: Sprout, i: number) => shade.copy(tints[i % 3]).lerp(tints[(i + 1) % 3], (s.size - 0.75) * 2);
    const { clumps } = groups;
    place(grass.current, clumps, (s) => [width * s.size, height * s.size * HEIGHT[s.growth]], (s, i) =>
      blend(s.growth === "forest" ? FOREST_TINTS : s.growth === "rock" ? ROCK_TINTS : MEADOW_TINTS, s, i),
    );
    place(flowers.current, groups.blooms, (s) => [width * 0.9, height * (0.95 + s.size * 0.2)]);
    // Wheat stands to an even height, as a sown field does.
    const ears = height * HEIGHT.field;
    place(wheat.current, groups.wheat, (s) => [width * 0.9 * s.size, ears * (0.92 + s.size * 0.1)], (s, i) => blend(WHEAT_TINTS, s, i));
    place(poppies.current, groups.poppies, (s) => [width * 0.8, ears * (0.95 + s.size * 0.1)]);
    const tree = cellSize * 0.3 * k;
    place(forest.current, groups.pines, (s) => [tree * s.size, tree * s.size], (_, i) => shade.copy(FOREST_TINTS[i % 3]).lerp(tint("#ffffff"), 0.55));
    // Boulders a few times a stone's size; each rock squat or tall by its turn.
    place(groups.rocks.length ? stones.current : null, groups.rocks, (s) => {
      const w = cellSize * k * (s.boulder ? 0.14 : 0.045) * s.size;
      return [w, w * (0.8 + (s.turn % 1) * 0.5)];
    }, (s, i) => blend(STONE_TINTS, s, i));
  }, [groups, k, spacing, cellSize, top]);

  useFrame(() => {
    const tile = glow.current;
    if (!tile) return;
    for (const m of materials.current) {
      if (!m) continue;
      m.emissive.copy(tile.emissive);
      m.emissiveIntensity = tile.emissiveIntensity * 0.6;
    }
  });

  const material = (i: number, compiler: (shader: WebGLProgramParametersWithUniforms) => void, look: "sky-lit" | "solid" | "glitter") => (
    <meshStandardMaterial
      ref={(m) => void (materials.current[i] = m)}
      vertexColors
      side={look === "sky-lit" ? DoubleSide : undefined}
      roughness={look === "glitter" ? 0.85 : 0.9}
      emissive={HIGHLIGHT}
      emissiveIntensity={0}
      defines={look === "sky-lit" ? { SKY_LIT: "" } : look === "glitter" ? { GLITTER: "" } : undefined}
      onBeforeCompile={compiler}
    />
  );
  const { clumps, blooms, pines, rocks } = groups;
  return (
    <>
      {clumps.length > 0 && (
        <instancedMesh key={`g${clumps.length}`} ref={grass} args={[CLUMP, undefined, clumps.length]} raycast={noRaycast} receiveShadow>
          {material(0, compile.grass, "sky-lit")}
        </instancedMesh>
      )}
      {blooms.length > 0 && (
        <instancedMesh key={`f${blooms.length}`} ref={flowers} args={[FLOWER, undefined, blooms.length]} raycast={noRaycast}>
          {material(1, compile.grass, "sky-lit")}
        </instancedMesh>
      )}
      {groups.wheat.length > 0 && (
        <instancedMesh key={`w${groups.wheat.length}`} ref={wheat} args={[WHEAT, undefined, groups.wheat.length]} raycast={noRaycast} receiveShadow>
          {material(2, compile.grass, "sky-lit")}
        </instancedMesh>
      )}
      {groups.poppies.length > 0 && (
        <instancedMesh key={`p${groups.poppies.length}`} ref={poppies} args={[POPPY, undefined, groups.poppies.length]} raycast={noRaycast}>
          {material(3, compile.grass, "sky-lit")}
        </instancedMesh>
      )}
      {pines.length > 0 && (
        <instancedMesh key={`t${pines.length}`} ref={forest} args={[TREE, undefined, pines.length]} raycast={noRaycast} castShadow receiveShadow>
          {material(4, compile.tree, "solid")}
        </instancedMesh>
      )}
      {rocks.length > 0 && (
        <instancedMesh key={`r${rocks.length}`} ref={stones} args={[ROCK, undefined, rocks.length]} raycast={noRaycast} castShadow receiveShadow>
          {material(5, compile.rock, "glitter")}
        </instancedMesh>
      )}
    </>
  );
}

const noRaycast = () => null;
