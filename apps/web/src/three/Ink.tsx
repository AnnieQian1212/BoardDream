import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { BackSide, BufferGeometry, Color, ShaderMaterial, Vector2 } from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { INK } from "./paint";

/**
 * Ink outlines, as in a storybook illustration: a copy of a mesh's back faces pushed out a fixed
 * number of screen pixels and drawn in dark brown, so only a rim shows around the object. One draw
 * call per outlined mesh and no extra render pass, which keeps it cheap on integrated GPUs.
 */

/** The canvas size in CSS pixels, shared by every ink material, so widths are CSS pixels too. */
const viewport = new Vector2(1, 1);

const materials = new Map<string, ShaderMaterial>();

function inkMaterial(width: number, grounded: boolean): ShaderMaterial {
  const key = `${width}|${grounded}`;
  let material = materials.get(key);
  if (!material) {
    material = new ShaderMaterial({
      side: BackSide,
      // An object resting on a surface has its bottom edge in that surface; pulled a little toward
      // the camera, the line along that edge shows instead of sinking into it.
      polygonOffset: grounded,
      polygonOffsetFactor: grounded ? -3 : 0,
      polygonOffsetUnits: grounded ? -3 : 0,
      uniforms: { color: { value: new Color(INK) }, width: { value: width }, viewport: { value: viewport } },
      vertexShader: /* glsl */ `
        uniform float width;
        uniform vec2 viewport;
        void main() {
          vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec2 dir = (projectionMatrix * vec4(normalMatrix * normal, 0.0)).xy;
          float len = length(dir);
          // Out along the normal as seen on screen, by the same number of pixels near and far.
          if (len > 1e-5) clip.xy += dir / len * width / viewport * clip.w * 2.0;
          gl_Position = clip;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 color;
        void main() {
          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    materials.set(key, material);
  }
  return material;
}

const creased = new WeakMap<BufferGeometry, BufferGeometry>();

/** The geometry with every normal smoothed, so the pushed-out copy has no gaps at sharp edges. */
function hull(geometry: BufferGeometry): BufferGeometry {
  let smooth = creased.get(geometry);
  if (!smooth) {
    // Only the positions: toCreasedNormals rewrites the normals of a geometry without an index in place.
    const lean = new BufferGeometry();
    lean.setAttribute("position", geometry.getAttribute("position"));
    if (geometry.index) lean.setIndex(geometry.index);
    const made = toCreasedNormals(lean, Math.PI);
    geometry.addEventListener("dispose", () => made.dispose());
    creased.set(geometry, made);
    smooth = made;
  }
  return smooth;
}

const noRaycast = () => null;

/**
 * Outlines its parent mesh, drawn with `geometry`, in ink `width` CSS pixels wide. `grounded` is for
 * solid things that stand on a surface; thin ones like cards would show the line through their face.
 */
export function Ink({ geometry, width = 1.5, grounded = false }: { geometry: BufferGeometry; width?: number; grounded?: boolean }) {
  return <mesh geometry={hull(geometry)} material={inkMaterial(width, grounded)} raycast={noRaycast} />;
}

/** Keeps ink widths in CSS pixels as the canvas resizes. Mount once in the scene. */
export function InkViewport() {
  const { width, height } = useThree((s) => s.size);
  useEffect(() => void viewport.set(Math.max(1, width), Math.max(1, height)), [width, height]);
  return null;
}
