/**
 * Render quality tiers. The table renders on demand (nothing is drawn while nothing moves), so
 * these mostly decide how expensive each animated frame is.
 *
 * - lowest: 1x pixels, no shadow maps, glowing cells cast no light, sparse grass
 * - low: up to 1.25x pixels, no shadow maps (integrated and mobile GPUs start here)
 * - medium: up to 1.5x pixels, soft shadow maps (discrete GPUs start here)
 * - high: up to 2x pixels, shadow maps and ambient occlusion (opt in with ?quality=high)
 *
 * If animation runs below ~30 fps the table steps down a tier and remembers it.
 */

export const TIERS = ["lowest", "low", "medium", "high"] as const;
export type Tier = (typeof TIERS)[number];

export interface Quality {
  tier: Tier;
  dpr: number;
  shadows: boolean;
  shadowMapSize: number;
  ambientOcclusion: boolean;
  /** Point lights over glowing cells (lanterns, fires). Each one costs every lit pixel a little. */
  glowLights: number;
  /** How thickly grass grows on green cells, relative to a full meadow. */
  grass: number;
}

const STORAGE_KEY = "boarddream:quality";

export function settings(tier: Tier): Quality {
  const device = window.devicePixelRatio || 1;
  const cap = { lowest: 1, low: 1.25, medium: 1.5, high: 2 }[tier];
  return {
    tier,
    dpr: Math.min(device, cap),
    shadows: tier === "medium" || tier === "high",
    shadowMapSize: tier === "high" ? 2048 : 1024,
    ambientOcclusion: tier === "high",
    glowLights: tier === "lowest" ? 0 : 4,
    grass: { lowest: 0.4, low: 0.7, medium: 1, high: 1.3 }[tier],
  };
}

/** Integrated, mobile and software renderers. */
const WEAK_GPU = /intel|iris|uhd|mali|adreno|powervr|swiftshader|llvmpipe|software|basic render|radeon\(tm\) graphics|vega \d+ graphics/i;

function gpuName(): string {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    return info ? String(gl!.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  } catch {
    return "";
  }
}

function remembered(): Tier | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return TIERS.includes(value as Tier) ? (value as Tier) : undefined;
  } catch {
    return undefined;
  }
}

/** `?quality=<tier>` wins, then a tier remembered from a slow session, then a guess from the GPU. */
export function initialTier(param: string | null): { tier: Tier; locked: boolean } {
  if (TIERS.includes(param as Tier)) return { tier: param as Tier, locked: true };
  const guess: Tier = WEAK_GPU.test(gpuName()) ? "low" : "medium";
  const saved = remembered();
  return { tier: saved && TIERS.indexOf(saved) < TIERS.indexOf(guess) ? saved : guess, locked: false };
}

export function stepDown(tier: Tier): Tier {
  const next = TIERS[Math.max(0, TIERS.indexOf(tier) - 1)];
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private windows may refuse storage; the step down still applies to this session.
  }
  return next;
}
