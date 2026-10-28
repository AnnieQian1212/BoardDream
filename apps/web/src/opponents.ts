import type { GameModule, Rng } from "@boarddream/engine";
import { socialMoves, tableBot, tableText } from "@boarddream/library";

/**
 * Muse Spark opponents. The local table bot plays the routine moves instantly; whenever the move it
 * would make is a social one (an offer, an answer to an offer, a bid, a claim, a call) Muse Spark
 * chooses among the social options instead and says a line of table talk. Any failure falls back
 * to the bot's move, so the game never stalls.
 */

const TIMEOUT_MS = 20_000;

export interface Decision {
  move: unknown;
  /** Table talk from Muse Spark, if it spoke. */
  say?: string;
}

export async function decide(
  game: GameModule,
  state: unknown,
  seat: number,
  numPlayers: number,
  recent: string[],
  rng: Rng,
  muse: boolean,
): Promise<Decision> {
  const moves = game.legalMoves(state, seat);
  const view = game.view ? game.view(state, seat) : state;
  const botMove = tableBot(game)({ game, state: view, player: seat, moves, rng });
  if (!muse) return { move: botMove };

  const describe = (move: unknown) => game.describeMove?.(state, move, seat) ?? JSON.stringify(move);
  const social = socialMoves(game, state, seat, moves);
  if (!social.includes(botMove)) return { move: botMove };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/opponent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        game: game.meta.name,
        rules: game.meta.rules ?? [game.meta.summary],
        seat,
        numPlayers,
        table: tableText(game, state, seat),
        recent: recent.slice(-14),
        moves: social.map(describe),
        advice: social.indexOf(botMove),
      }),
    });
    if (!res.ok) return { move: botMove };
    const reply = (await res.json()) as { move: number; say: string };
    return { move: social[reply.move] ?? botMove, say: reply.say?.trim() || undefined };
  } catch {
    return { move: botMove };
  } finally {
    clearTimeout(timer);
  }
}
