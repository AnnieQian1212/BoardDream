import type { GameModule, Rng } from "@boarddream/engine";
import type { Advisor } from "@boarddream/library";
import type { BotReply, BotRequest } from "./bot.worker";
import { generatedSource } from "./generated";

/**
 * Asks the bot worker (bot.worker.ts) for a seat's move, so its playouts run off the main thread.
 * One worker serves the whole page, a request at a time in order. Where workers cannot run, or the
 * worker fails, the advisor rejects and the page works the move out itself (decideSeat).
 */
let worker: Worker | undefined;
let next = 0;
const waiting = new Map<number, { resolve(index: number): void; reject(err: unknown): void }>();

function botWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./bot.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<BotReply>) => {
      const job = waiting.get(event.data.id);
      waiting.delete(event.data.id);
      if (!job) return;
      if (event.data.index >= 0) job.resolve(event.data.index);
      else job.reject(new Error("the bot worker could not decide"));
    };
    worker.onerror = (event) => {
      for (const job of waiting.values()) job.reject(event);
      waiting.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  return worker;
}

/** An advisor for decideSeat that asks the worker; the seed comes from the match's own stream. */
export function workerAdvisor(game: GameModule, state: unknown, seat: number, rng: Rng): Advisor {
  return () =>
    new Promise<number>((resolve, reject) => {
      if (typeof Worker === "undefined") return reject(new Error("no workers here"));
      const id = next++;
      waiting.set(id, { resolve, reject });
      const request: BotRequest = { id, gameId: game.meta.id, source: generatedSource(game), state, seat, seed: rng.int(2 ** 31) };
      try {
        botWorker().postMessage(request);
      } catch (err) {
        waiting.delete(id);
        reject(err);
      }
    });
}
