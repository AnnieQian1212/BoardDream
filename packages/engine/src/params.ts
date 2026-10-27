import type { Rng } from "./rng";
import type { ParamSpec, Params } from "./types";

/** Fill in defaults and clamp overrides to each spec's range. Unknown keys are dropped. */
export function resolveParams(specs: readonly ParamSpec[], overrides: Params = {}): Params {
  const out: Params = {};
  for (const spec of specs) {
    const value = overrides[spec.key];
    switch (spec.kind) {
      case "int":
        out[spec.key] =
          typeof value === "number" ? Math.min(spec.max, Math.max(spec.min, Math.round(value))) : spec.default;
        break;
      case "bool":
        out[spec.key] = typeof value === "boolean" ? value : spec.default;
        break;
      case "choice":
        out[spec.key] = typeof value === "string" && spec.options.includes(value) ? value : spec.default;
        break;
    }
  }
  return out;
}

/** Random point in parameter space, so fuzzing covers every slider position users can reach. */
export function sampleParams(specs: readonly ParamSpec[], rng: Rng): Params {
  const out: Params = {};
  for (const spec of specs) {
    switch (spec.kind) {
      case "int": {
        const step = spec.step ?? 1;
        out[spec.key] = spec.min + step * rng.int(Math.floor((spec.max - spec.min) / step) + 1);
        break;
      }
      case "bool":
        out[spec.key] = rng.next() < 0.5;
        break;
      case "choice":
        out[spec.key] = rng.pick(spec.options);
        break;
    }
  }
  return out;
}
