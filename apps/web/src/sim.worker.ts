// Balance simulation off the main thread: bots play the current rules and the tuning panel gets
// running statistics every few games, so dragging a slider never freezes the table.
import { simulate, type GameModule, type Params } from "@boarddream/engine";
import { defaultBot, referenceGames } from "@boarddream/library";
import { loadGeneratedGame } from "./generated";

export interface SimRequest {
  gameId: string;
  /** Rules source for generated games; reference games are found by id. */
  source?: string;
  numPlayers: number;
  params: Params;
  games: number;
}

self.onmessage = (event: MessageEvent<SimRequest>) => {
  const { gameId, source, numPlayers, params, games } = event.data;
  const game: GameModule | undefined = source ? loadGeneratedGame(source) : referenceGames.find((g) => g.meta.id === gameId);
  if (!game) return;
  const bots = new Array(numPlayers).fill(defaultBot(game));
  simulate(game, { numPlayers, params, games, bots, seed: 1, maxTurns: 1000, statsEvery: 20, onStats: (stats) => self.postMessage(stats) });
};
