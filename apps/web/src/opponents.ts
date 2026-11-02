import type { GameModule, Rng } from "@boarddream/engine";
import { decideSeat, type Chooser, type Decision } from "@boarddream/library";

/**
 * Muse Spark opponents in the browser: the library's seat decision (decideSeat), with the model
 * reached through the server's /api/opponent. Without Muse, or when the server is slow or says no,
 * the game's own bot plays.
 */

const TIMEOUT_MS = 20_000;

export type { Decision };

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

export function decide(game: GameModule, state: unknown, seat: number, numPlayers: number, history: string[], rng: Rng, muse: boolean): Promise<Decision> {
  return decideSeat(game, state, seat, numPlayers, history, rng, muse ? serverChooser : undefined);
}
