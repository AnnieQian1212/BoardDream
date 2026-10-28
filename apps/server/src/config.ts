// Load the repo-root .env when present; real environment variables take precedence.
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {
  // No .env file: rely on the environment.
}

const env = (name: string, fallback = "") => process.env[name] || fallback;

export const config = {
  port: Number(env("PORT", "8787")),
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
    model: env("OPEN_MODEL", "meta-models/muse-spark-open-1026"),
    // At its default effort it can spend 3,000 tokens thinking before a one-line JSON move; low
    // effort answers in a few seconds.
    defaults: { reasoningEffort: "low", maxTokens: 4096 } as const,
  },
};

export const hasOpenModel = () => Boolean(config.openModel.apiKey && config.openModel.baseUrl);
