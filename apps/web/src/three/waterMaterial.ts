import { DataTexture, LinearFilter, RGBAFormat, Vector2, Vector3, Vector4, type Texture, type WebGLProgramParametersWithUniforms } from "three";
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
  /**
   * The board's printed names, and where their plane lies: world x and z of its middle and one over
   * its width and depth. The jelly rises above that plane, so it carries the names on its surface.
   */
  uPrint: { value: Texture | null };
  uPrintMap: { value: Vector4 };
}

/** One pool's dome (jelly.ts): its height in world units, its squash, and its sway per world unit. */
export interface JellyUniforms {
  uJelly: { value: Vector4 };
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
    uPrint: { value: null },
    uPrintMap: { value: new Vector4(0, 0, 0, 0) },
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
uniform sampler2D uPrint;
uniform vec4 uPrintMap;
varying vec2 vWaterXZ;
varying vec2 vJellySlope;
varying float vJelly;

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
// it never smears over the tile's edge. The jelly's thickness bends the light more where it is thick.
float deep = wave.a;
float thick = clamp(vJelly, 0.0, 1.6);
vec2 shift = slope * uRefract * (0.25 + 0.75 * deep) * (0.7 + 0.6 * thick);
// The dome is a lens: through its rounded rim the bed is seen from further in, so the art bunches
// toward the shore as under a magnifying glass. The shift points inward, so it never leaves the tile.
shift += vJellySlope * uRefract * 0.06;
#ifdef USE_MAP
  diffuseColor *= texture2D(map, vMapUv + shift * uMapScale);
#else
  vec2 bed = (vWaterXZ + shift) * uBedScale;
  diffuseColor.rgb *= mix(0.88, 1.1, waterNoise(bed * 1.6) * 0.6 + waterNoise(bed * 4.1) * 0.4);
#endif
// Shallows are lighter, open water cooler and darker; and like a jelly sweet, the thin rim is pale
// and the thick middle rich in color.
diffuseColor.rgb = mix(diffuseColor.rgb * 1.06, diffuseColor.rgb * vec3(0.74, 0.84, 0.92), deep);
float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(vec3(luma), diffuseColor.rgb, 1.0 + 0.55 * thick) * mix(1.14, 0.94, min(thick, 1.0));
// Ripples shade like relief, lit on the side facing the sun and dim on the far side. Glints alone
// show them on deep blue water but vanish on a pale lagoon; shading shows on both.
float relief = -dot(slope, normalize(uSun.xz)) * uTilt;
diffuseColor.rgb *= 1.0 + clamp(relief * 1.5, -0.3, 0.3);
// A faint sunlit web on the bed that the ripples bend, and bright light where a crest focuses it.
// It comes and goes in patches: even everywhere, over a large sea it read as the tiles of a pool.
float web = waterWeb((vWaterXZ + shift * 1.6) * uBedScale * 1.4);
web *= 0.45 * smoothstep(0.42, 0.78, waterNoise((vWaterXZ + shift) * uBedScale * 0.32));
float focus = clamp(-curve * 3.0, 0.0, 0.25);
diffuseColor.rgb += vec3(1.0, 0.97, 0.86) * (web * 0.07 + focus) * (0.3 + 0.7 * deep);
// The cell's printed name, laid on the jelly's surface after its highlights (NORMAL).
vec4 printed = texture2D(uPrint, vec2(0.5 + (vWaterXZ.x - uPrintMap.x) * uPrintMap.z, 0.5 - (vWaterXZ.y - uPrintMap.y) * uPrintMap.w));
`;

const NORMAL = /* glsl */ `
// The dome's own slope, with the ripples running over it.
vec2 tilt = vJellySlope + slope * uTilt;
normal = normalize((viewMatrix * vec4(normalize(vec3(-tilt.x, 1.0, -tilt.y)), 0.0)).xyz);
// Sun glints where a moving crest turns the light toward the eye; still water keeps none, so the
// rings read as rings. It is added before lighting, so it fades with the light at night.
vec3 mirror = reflect(-normalize(vViewPosition), normal);
vec3 sunView = normalize((viewMatrix * vec4(uSun, 0.0)).xyz);
float glint = pow(max(dot(mirror, sunView), 0.0), 60.0);
diffuseColor.rgb += vec3(1.0, 0.98, 0.92) * glint * 0.8 * smoothstep(0.004, 0.03, length(slope));
// Like a jelly sweet: a soft white highlight on the shoulder that faces the sun, the same on every
// pool, and a rim that brightens where the surface turns away from the eye.
vec3 dome = normalize((viewMatrix * vec4(normalize(vec3(-vJellySlope.x, 1.0, -vJellySlope.y)), 0.0)).xyz);
float sheen = pow(max(dot(reflect(-normalize(vViewPosition), dome), sunView), 0.0), 18.0);
float rim = pow(1.0 - max(dot(dome, normalize(vViewPosition)), 0.0), 3.0);
diffuseColor.rgb += vec3(1.0, 0.99, 0.95) * (sheen * 0.55 + rim * 0.3);
// A touch more ink than the plane's own blend: the bright jelly behind thin strokes washed them out.
printed.a = min(printed.a * 1.25, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, printed.rgb, printed.a);
`;

/** The name is printed matte: no gloss or clear coat reflects over it, so it stays readable. */
const MATTE_PRINT = /* glsl */ `
material.roughness = mix(material.roughness, 1.0, printed.a);
#ifdef USE_CLEARCOAT
  material.clearcoat *= 1.0 - printed.a;
#endif
`;

/**
 * Lifts a pool's surface into its dome (jelly.ts attributes `jelly` and `jellySlope`), squashed and
 * swayed by its wobble. Sway is a slope of the top, so the far side of the pool rises as the near
 * side dips.
 */
const LIFT = /* glsl */ `
#include <begin_vertex>
float jellyHeight = uJelly.x * (1.0 + uJelly.y + dot(uJelly.zw, position.xz));
transformed.y += jelly * jellyHeight;
vJellySlope = jellySlope * jellyHeight + jelly * uJelly.x * uJelly.zw;
vJelly = jelly * (1.0 + uJelly.y);
`;

/**
 * Makes a MeshPhysicalMaterial a pool of jelly: lit, shadowed and reflecting like the rest of the
 * table, with its clear coat following the dome and the ripples.
 */
export function waterCompiler(uniforms: WaterUniforms, jelly: JellyUniforms) {
  return (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms, jelly);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec4 uJelly;\nattribute float jelly;\nattribute vec2 jellySlope;\nvarying vec2 vWaterXZ;\nvarying vec2 vJellySlope;\nvarying float vJelly;",
      )
      .replace("#include <begin_vertex>", LIFT)
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWaterXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${DECLARATIONS}`)
      .replace("#include <map_fragment>", SURFACE)
      .replace("#include <normal_fragment_maps>", NORMAL)
      .replace("#include <lights_physical_fragment>", `#include <lights_physical_fragment>\n${MATTE_PRINT}`)
      .replace("#include <clearcoat_normal_fragment_begin>", "#ifdef USE_CLEARCOAT\nvec3 clearcoatNormal = normal;\n#endif");
  };
}
