// The game's profile off the main thread: random games give complexity, luck and interaction in a
// moment; the planner games behind the strategy score follow, since a strong bot plays slowly.
import { measureProfile, plannerWinRate, scoreProfile, withPlanner, type GameModule, type Params } from "@boarddream/engine";
import { ownBot, referenceGames, tableBot } from "@boarddream/library";
import { loadGeneratedGame } from "./generated";

export interface ProfileRequest {
  gameId: string;
  /** Rules source for generated games; reference games are found by id. */
  source?: string;
  numPlayers: number;
  params: Params;
}

/** Bluffing is the skill in bluff games, and only a game's own bot can bluff; the generic planner cannot. */
const measurable = (game: GameModule) => ownBot(game) !== undefined || game.meta.family !== "bluff";

self.onmessage = (event: MessageEvent<ProfileRequest>) => {
  const { gameId, source, numPlayers, params } = event.data;
  const game: GameModule | undefined = source ? loadGeneratedGame(source) : referenceGames.find((g) => g.meta.id === gameId);
  if (!game) return;
  try {
    const measures = measureProfile(game, { numPlayers, params, games: 20 });
    self.postMessage({ profile: scoreProfile(measures), pending: measurable(game) });
    if (!measurable(game)) return;
    // The game's own bot is fast; the generic planner runs playouts on every move, so it plays fewer games.
    const games = ownBot(game) ? 30 : 3 * numPlayers;
    const rate = plannerWinRate(game, tableBot(game), { numPlayers, params, games });
    self.postMessage({ profile: scoreProfile(withPlanner(measures, rate)), pending: false });
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
};
