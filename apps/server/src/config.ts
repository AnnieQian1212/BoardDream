import { OPEN_MODEL_ID, OPEN_MODEL_OPTIONS, type ChatOptions } from "./meta/client";

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
  /**
   * SMTP for the codes that check an email at sign-up (codes.ts). Without a host a local server
   * prints codes to its console and a public demo asks for none.
   */
  mail: {
    host: env("MAIL_SMTP_HOST"),
    port: Number(env("MAIL_SMTP_PORT", "465")),
    user: env("MAIL_SMTP_USER"),
    pass: env("MAIL_SMTP_PASS"),
    from: env("MAIL_FROM"),
  },
  meta: {
    baseUrl: env("META_BASE_URL", "https://api.meta.ai/v1"),
    apiKey: env("MODEL_API_KEY"),
  },
  /**
   * How long Muse Spark reasons before it answers in the generation pipeline ("default" leaves it
   * to the model). At its default it spends about 25,000 tokens thinking before writing rules; at
   * low effort most first drafts fail (eval/generation/README.md), so the app runs at medium.
   */
  designerEffort: env("DESIGNER_EFFORT", "medium") as NonNullable<ChatOptions["reasoningEffort"]> | "default",
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
