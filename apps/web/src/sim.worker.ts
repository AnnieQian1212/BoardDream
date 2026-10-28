// Balance simulation off the main thread: bots play the current rules and the tuning panel gets
// running statistics every few games, so dragging a slider never freezes the table.
import { playMatch, type BalanceStats, type GameModule, type Params } from "@boarddream/engine";
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

const BATCH = 20;

self.onmessage = (event: MessageEvent<SimRequest>) => {
  const { gameId, source, numPlayers, params, games } = event.data;
  const game: GameModule | undefined = source ? loadGeneratedGame(source) : referenceGames.find((g) => g.meta.id === gameId);
  if (!game) return;
  const bots = new Array(numPlayers).fill(defaultBot(game));
  const wins = new Array<number>(numPlayers).fill(0);
  const turns: number[] = [];
  let draws = 0;
  let truncated = 0;
  let errors = 0;
  let firstError: string | undefined;

  for (let i = 0; i < games; i++) {
    try {
      const result = playMatch(game, { numPlayers, params, seed: 1 + i, bots, maxTurns: 1000 });
      turns.push(result.turns);
      if (result.truncated) truncated++;
      if (result.outcome.winners.length === 0) draws++;
      for (const winner of result.outcome.winners) wins[winner]++;
    } catch (err) {
      errors++;
      firstError ??= err instanceof Error ? err.message : String(err);
    }
    if ((i + 1) % BATCH === 0 || i === games - 1) {
      const played = Math.max(1, turns.length);
      const sorted = turns.slice().sort((a, b) => a - b);
      const stats: BalanceStats = {
        games: turns.length,
        winRateBySeat: wins.map((w) => w / played),
        drawRate: draws / played,
        firstPlayerEdge: wins[0] / played - 1 / numPlayers,
        avgTurns: turns.reduce((a, b) => a + b, 0) / played,
        medianTurns: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
        truncatedRate: truncated / played,
        errors,
        firstError,
      };
      self.postMessage(stats);
    }
  }
};
