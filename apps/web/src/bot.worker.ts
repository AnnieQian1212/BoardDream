// The table's bots think here, off the main thread: a move's look-ahead playouts took the page for
// up to two seconds at a time (Saffron Wake), freezing the table and the pointer while they ran.
import { createRng, type GameModule } from "@boarddream/engine";
import { botMove, referenceGames } from "@boarddream/library";
import { loadGeneratedGame } from "./generated";

export interface BotRequest {
  id: number;
  gameId: string;
  /** Rules source for a generated game; a hand-made game is found by its id. */
  source?: string;
  state: unknown;
  seat: number;
  seed: number;
}

export interface BotReply {
  id: number;
  /** The move's place among the seat's legal moves, or -1 when the bot could not decide. */
  index: number;
}

const games = new Map<string, GameModule>();

function gameFor(gameId: string, source?: string): GameModule | undefined {
  const key = `${gameId}:${source?.length ?? 0}`;
  let game = games.get(key);
  if (!game) {
    game = source ? loadGeneratedGame(source) : referenceGames.find((g) => g.meta.id === gameId);
    if (game) games.set(key, game);
  }
  return game;
}

self.onmessage = (event: MessageEvent<BotRequest>) => {
  const { id, gameId, source, state, seat, seed } = event.data;
  let index = -1;
  try {
    const game = gameFor(gameId, source);
    if (game) {
      const moves = game.legalMoves(state, seat);
      index = moves.indexOf(botMove(game, state, seat, createRng(seed), moves));
    }
  } catch {
    // The page works the move out itself.
  }
  self.postMessage({ id, index } satisfies BotReply);
};
