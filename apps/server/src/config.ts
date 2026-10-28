import { OPEN_MODEL_ID, OPEN_MODEL_OPTIONS } from "./meta/client";

// Load the repo-root .env when present; real environment variables take precedence.
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {
  // No .env file: rely on the environment.
}

const env = (name: string, fallback = "") => process.env[name] || fallback;

export const config = {
  port: Number(env("PORT", "8787")),
  /** A public deployment: model calls are rate-limited per client and per day (see guard.ts). */
  publicDemo: env("PUBLIC_DEMO") === "1",
  /** Also serve the built web app (apps/web/dist), so one process hosts everything. */
  serveWeb: env("SERVE_WEB") === "1",
  meta: {
    baseUrl: env("META_BASE_URL", "https://api.meta.ai/v1"),
    apiKey: env("MODEL_API_KEY"),
  },
  models: {
    designer: env("DESIGNER_MODEL", "muse-spark-1.3"),
    wonder: env("WONDER_MODEL", "muse-wonder-1.0"),
    image: env("IMAGE_MODEL", "muse-image-1.0"),
    sam: env("SAM_MODEL", "sam-3.1"),
  },
  /** Muse Spark Open on an OpenAI-compatible host (Baseten), for high-volume opponent play. */
  openModel: {
    baseUrl: env("OPEN_MODEL_BASE_URL"),
    apiKey: env("OPEN_MODEL_API_KEY"),
    model: env("OPEN_MODEL", OPEN_MODEL_ID),
    defaults: OPEN_MODEL_OPTIONS,
  },
};

export const hasOpenModel = () => Boolean(config.openModel.apiKey && config.openModel.baseUrl);
