import { DataTexture, LinearFilter, RGBAFormat, Vector2, Vector3, Vector4, type WebGLProgramParametersWithUniforms } from "three";
import { CURVE_GAIN, SLOPE_GAIN, type WaterGrid } from "./water";

/**
 * Uniforms every water tile on a board shares. The surface is drawn in one pass: what lies under
 * the water is known (the tile's color, or its painting), so the shader looks it up directly at a
 * shifted spot instead of rendering the scene behind the water first.
 */
export interface WaterUniforms {
  uWave: { value: DataTexture };
  /** World x and z of the grid's first node, and one over the grid's world width and depth. */
  uGrid: { value: Vector4 };
  /** World units the bed shifts per unit of slope: the refraction. */
  uRefract: { value: number };
  /** How far a slope tilts the surface normal: the strength of the moving highlights. */
  uTilt: { value: number };
  /** Pattern scale of the sand on a plain bed and of the sunlit web, per world unit. */
  uBedScale: { value: number };
  /** Texture units per world unit on a painted bed, so the shift moves the painting the same distance. */
  uMapScale: { value: Vector2 };
  /** Toward the table's key light, in world space: where the sun glints off a crest. */
  uSun: { value: Vector3 };
}

export function waterUniforms(grid: WaterGrid, origin: [number, number], cell: number): WaterUniforms {
  const texture = new DataTexture(grid.pixels, grid.cols, grid.rows, RGBAFormat);
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  // Texel centers sit on the nodes.
  const [width, depth] = [grid.cols * grid.spacing, grid.rows * grid.spacing];
  return {
    uWave: { value: texture },
    uGrid: { value: new Vector4(origin[0] + grid.x0 - grid.spacing / 2, origin[1] + grid.z0 - grid.spacing / 2, 1 / width, 1 / depth) },
    uRefract: { value: cell * 0.8 },
    uTilt: { value: 6 },
    uBedScale: { value: 2.2 / cell },
    uMapScale: { value: new Vector2(0, 0) },
    // Scene.tsx sets the key light up and to the left of the table, toward the viewer.
    uSun: { value: new Vector3(-45, 90, 35).normalize() },
  };
}

const DECLARATIONS = /* glsl */ `
uniform sampler2D uWave;
uniform vec4 uGrid;
uniform float uRefract;
uniform float uTilt;
uniform float uBedScale;
uniform vec2 uMapScale;
uniform vec3 uSun;
varying vec2 vWaterXZ;

float waterHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float waterNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(waterHash(i), waterHash(i + vec2(1.0, 0.0)), f.x), mix(waterHash(i + vec2(0.0, 1.0)), waterHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Sunlight through a wavy surface gathers into a web of bright lines: the edges of a Voronoi pattern.
float waterWeb(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 r = g + vec2(waterHash(i + g), waterHash(i + g + 17.31)) - f;
      float d = dot(r, r);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return 1.0 - smoothstep(0.0, 0.22, sqrt(d2) - sqrt(d1));
}
`;

const SURFACE = /* glsl */ `
vec4 wave = texture2D(uWave, (vWaterXZ - uGrid.xy) * uGrid.zw);
vec2 slope = (wave.rg - 0.5) * (2.0 / ${SLOPE_GAIN.toFixed(1)});
float curve = (wave.b - 0.5) * (2.0 / ${CURVE_GAIN.toFixed(1)});
// Depth from the shore: 0 at the rim, 1 a little way out. Near the rim the bed barely shifts, so
// it never smears over the tile's edge.
float deep = wave.a;
vec2 shift = slope * uRefract * (0.25 + 0.75 * deep);
#ifdef USE_MAP
  diffuseColor *= texture2D(map, vMapUv + shift * uMapScale);
#else
  vec2 bed = (vWaterXZ + shift) * uBedScale;
  diffuseColor.rgb *= mix(0.88, 1.1, waterNoise(bed * 1.6) * 0.6 + waterNoise(bed * 4.1) * 0.4);
#endif
// Shallows are lighter, open water cooler and darker.
diffuseColor.rgb = mix(diffuseColor.rgb * 1.06, diffuseColor.rgb * vec3(0.74, 0.84, 0.92), deep);
// Ripples shade like relief, lit on the side facing the sun and dim on the far side. Glints alone
// show them on deep blue water but vanish on a pale lagoon; shading shows on both.
float relief = -dot(slope, normalize(uSun.xz)) * uTilt;
diffuseColor.rgb *= 1.0 + clamp(relief * 1.5, -0.3, 0.3);
// A faint sunlit web on the bed that the ripples bend, and bright light where a crest focuses it.
float web = waterWeb((vWaterXZ + shift * 1.6) * uBedScale * 1.4);
float focus = clamp(-curve * 5.0, 0.0, 0.6);
diffuseColor.rgb += vec3(1.0, 0.97, 0.86) * (web * 0.07 + focus) * (0.3 + 0.7 * deep);
`;

const NORMAL = /* glsl */ `
normal = normalize((viewMatrix * vec4(normalize(vec3(-slope.x * uTilt, 1.0, -slope.y * uTilt)), 0.0)).xyz);
// Sun glints where a moving crest turns the light toward the eye; still water keeps none, so the
// rings read as rings. It is added before lighting, so it fades with the light at night.
vec3 mirror = reflect(-normalize(vViewPosition), normal);
float glint = pow(max(dot(mirror, normalize((viewMatrix * vec4(uSun, 0.0)).xyz)), 0.0), 60.0);
diffuseColor.rgb += vec3(1.0, 0.98, 0.92) * glint * 1.4 * smoothstep(0.004, 0.03, length(slope));
`;

/** Makes a MeshStandardMaterial a water surface: lit, shadowed and reflecting like the rest of the table. */
export function waterCompiler(uniforms: WaterUniforms) {
  return (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vWaterXZ;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWaterXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${DECLARATIONS}`)
      .replace("#include <map_fragment>", SURFACE)
      .replace("#include <normal_fragment_maps>", NORMAL);
  };
}
