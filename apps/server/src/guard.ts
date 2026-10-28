import type { OpponentRequest } from "./agent/opponent";

/**
 * Guards for a public deployment, where every model call spends credits: rate limits per client
 * and per day, and size checks on what a client may send. Plain TypeScript with no Node APIs, so
 * the Node server and edge functions share it. Limits live in memory: a restart or another edge
 * instance starts fresh, so they stop casual abuse rather than a determined attacker.
 */

export interface Limit {
  /** Calls one client may make per window. */
  perClient: number;
  windowMs: number;
  /** Calls everyone together may make per UTC day. */
  perDay: number;
}

export const LIMITS = {
  /** A game takes minutes of model calls and fuzzing. */
  generate: { perClient: 3, windowMs: 60 * 60_000, perDay: 40 },
  /** One move by an AI opponent: a few seconds of a model. */
  opponent: { perClient: 120, windowMs: 10 * 60_000, perDay: 5000 },
  /** A deck or a board painted by Muse Image, checked by SAM. */
  art: { perClient: 2, windowMs: 60 * 60_000, perDay: 20 },
} satisfies Record<string, Limit>;

export class RateLimiter {
  private readonly calls = new Map<string, number[]>();
  private day = "";
  private today = 0;

  constructor(private readonly limit: Limit) {}

  /** Records a call by `client` and says whether it is allowed; if not, how long to wait. */
  take(client: string, now = Date.now()): { ok: true } | { ok: false; retryAfterS: number; reason: string } {
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== this.day) {
      this.day = day;
      this.today = 0;
    }
    if (this.today >= this.limit.perDay) {
      const midnight = Date.parse(`${day}T00:00:00Z`) + 86_400_000;
      return { ok: false, retryAfterS: Math.ceil((midnight - now) / 1000), reason: "the demo's daily budget is used up; try again tomorrow" };
    }
    const recent = (this.calls.get(client) ?? []).filter((t) => t > now - this.limit.windowMs);
    if (recent.length >= this.limit.perClient) {
      this.calls.set(client, recent);
      return { ok: false, retryAfterS: Math.ceil((recent[0] + this.limit.windowMs - now) / 1000), reason: "too many requests from you; try again soon" };
    }
    recent.push(now);
    this.calls.set(client, recent);
    this.today++;
    // Forget clients whose window has passed, so the map stays small.
    if (this.calls.size > 5000) for (const [key, times] of this.calls) if (times[times.length - 1] <= now - this.limit.windowMs) this.calls.delete(key);
    return { ok: true };
  }
}

const isText = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
const isTextList = (value: unknown, count: number, max: number): value is string[] =>
  Array.isArray(value) && value.length <= count && value.every((item) => isText(item, max));

/** Why an opponent request is malformed or too large for the prompt, or null if it is fine. */
export function opponentRequestProblem(body: unknown): string | null {
  if (body === null || typeof body !== "object") return "expected a JSON object";
  const req = body as Partial<OpponentRequest>;
  if (!isText(req.game, 80)) return "game must be a short string";
  if (!isTextList(req.rules, 12, 600)) return "rules must be at most 12 strings of 600 characters";
  if (!Number.isInteger(req.numPlayers) || req.numPlayers! < 1 || req.numPlayers! > 10) return "numPlayers must be 1-10";
  if (!Number.isInteger(req.seat) || req.seat! < 0 || req.seat! >= req.numPlayers!) return "seat must be a seat at the table";
  if (!isText(req.table, 8000)) return "table must be at most 8,000 characters";
  if (!isTextList(req.recent, 20, 400)) return "recent must be at most 20 strings of 400 characters";
  if (!isTextList(req.moves, 120, 200) || req.moves.length === 0) return "moves must be 1-120 strings of 200 characters";
  if (req.advice !== undefined && (!Number.isInteger(req.advice) || req.advice < 0 || req.advice >= req.moves.length)) return "advice must index a move";
  return null;
}

/** The client's address as a proxy or edge network reports it, else the direct peer. */
export function clientAddress(headers: { get(name: string): string | null }, peer?: string): string {
  return headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0].trim() ?? peer ?? "unknown";
}
