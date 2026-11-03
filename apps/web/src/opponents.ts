import type { GameModule, Rng } from "@boarddream/engine";
import { decideSeat, type Chooser, type Decision } from "@boarddream/library";
import { workerAdvisor } from "./botWorker";

/**
 * Muse Spark opponents in the browser: the library's seat decision (decideSeat), with the model
 * reached through the server's /api/opponent. Without Muse, or when the server is slow or says no,
 * the game's own bot plays.
 */

const TIMEOUT_MS = 20_000;

export type { Decision };

/** A model id as a player would name it: "meta-models/muse-spark-open-1026" is Muse Spark Open. */
export function modelName(id: string): string {
  if (/muse-spark-open/i.test(id)) return "Muse Spark Open";
  if (/muse-spark/i.test(id)) return "Muse Spark";
  return id;
}

/** Asks the server's opponent model; rejects on a failed request or after TIMEOUT_MS. */
export const serverChooser: Chooser = async (request) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/opponent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error(res.statusText);
    return (await res.json()) as { move: number; say: string };
  } finally {
    clearTimeout(timer);
  }
};

/** A seat's move: the bot's, worked out off the main thread (botWorker.ts), or the model's on a social move. */
export function decide(game: GameModule, state: unknown, seat: number, numPlayers: number, history: string[], rng: Rng, muse: boolean): Promise<Decision> {
  return decideSeat(game, state, seat, numPlayers, history, rng, muse ? serverChooser : undefined, workerAdvisor(game, state, seat, rng));
}
