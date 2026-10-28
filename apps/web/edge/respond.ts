/** JSON responses for the edge functions in ../functions (Cloudflare Pages Functions). */
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

/** Secrets and settings from the Pages project (Settings, Variables and Secrets). */
export interface Env {
  OPEN_MODEL_API_KEY?: string;
  OPEN_MODEL_BASE_URL?: string;
  OPEN_MODEL?: string;
  /** "0" turns the AI opponents off without a redeploy. */
  OPPONENTS_ENABLED?: string;
}

export const opponentsOn = (env: Env) => Boolean(env.OPEN_MODEL_API_KEY && env.OPEN_MODEL_BASE_URL) && env.OPPONENTS_ENABLED !== "0";
