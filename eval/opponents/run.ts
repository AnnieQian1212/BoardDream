// Muse Spark opponents against the game's own bot: does handing the social moves (offers, bids,
// calls) to Muse Spark, with the bot's move as advice, play at least as well as the bot alone?
//
//   npm run eval:opponents            # Muse Spark 1.3 on the Meta Model API
//   npm run eval:opponents -- open    # Muse Spark Open on Baseten (OPEN_MODEL_* in .env), more games
import { resolveParams, type GameModule, type Rng } from "@boarddream/engine";
import { botMove, decideSeat, lanternIsles, liarsDice, type Chooser } from "@boarddream/library";
import { chooseMove } from "../../apps/server/src/agent/opponent";
import { historyFor, isOver, nextSeat, playMove, startMatch } from "../../apps/web/src/match";
import { config } from "../../apps/server/src/config";
import { CachedModelClient } from "../../apps/server/src/meta/cache";

const here = new URL("./", import.meta.url);
const open = process.argv[2] === "open";
const llm = new CachedModelClient(open ? config.openModel : { ...config.meta, model: config.models.designer }, new URL("cache/", here));
const label = open ? "Muse Spark Open" : "Muse Spark";
// Muse Spark 1.3 list prices per token; Baseten bills the open model's calls, reported here in tokens.
const PRICE = { prompt: 1.25e-6, completion: 4.25e-6 };
// The open model is cheap enough for bigger samples. Game i is dealt from seed 1000 + i, so the
// first games of the open run replay the deals of the Muse Spark run.
const GAMES = open ? { liarsDice: 50, lanternIsles: 15 } : { liarsDice: 20, lanternIsles: 9 };
const CONCURRENCY = 8;

interface Tally {
  decisions: number;
  overruled: number;
  failures: number;
  talk: string[];
}

type Decider = (state: unknown, seat: number, history: string[], rng: Rng) => Promise<{ move: unknown; say?: string }>;

const botDecider =
  (game: GameModule): Decider =>
  async (state, seat, _history, rng) => ({ move: botMove(game, state, seat, rng) });

/** The model straight from the server's client: the benchmark's adapter at the app's seam. */
const modelChooser: Chooser = (request) => chooseMove(llm, request);

/** Exactly the web app's decision (decideSeat), with the model called directly instead of through the server. */
const museDecider =
  (game: GameModule, numPlayers: number, tally: Tally): Decider =>
  async (state, seat, history, rng) => {
    const decision = await decideSeat(game, state, seat, numPlayers, history, rng, modelChooser);
    if (decision.asked) tally.decisions++;
    if (decision.overruled) tally.overruled++;
    if (decision.failed) tally.failures++;
    if (decision.say) tally.talk.push(`${game.describeMove?.(state, decision.move, seat) ?? JSON.stringify(decision.move)} — "${decision.say}"`);
    return decision;
  };

/** A whole game the way the table plays it: the app's match, each seat told the history as it saw it. */
async function play(game: GameModule, numPlayers: number, seed: number, deciders: Decider[]) {
  let match = startMatch(game, numPlayers, resolveParams(game.params), 0, seed);
  for (let turn = 0; turn < 2000 && !isOver(match); turn++) {
    const seat = nextSeat(match)!;
    const { move, say } = await deciders[seat](match.state, seat, historyFor(match, seat), match.rng);
    match = playMove(match, seat, move, say);
  }
  return game.outcome(match.state).winners;
}

async function matchup(game: GameModule, numPlayers: number, games: number) {
  const tally: Tally = { decisions: 0, overruled: 0, failures: 0, talk: [] };
  let museWins = 0;
  // The Muse seat rotates so no seat order favors it.
  const results = await mapPool(
    Array.from({ length: games }, (_, i) => i),
    CONCURRENCY,
    async (i) => {
      const museSeat = i % numPlayers;
      const deciders = Array.from({ length: numPlayers }, (_, seat) => (seat === museSeat ? museDecider(game, numPlayers, tally) : botDecider(game)));
      const winners = await play(game, numPlayers, 1000 + i, deciders);
      return winners.includes(museSeat) ? 1 / winners.length : 0;
    },
  );
  museWins = results.reduce((a, b) => a + b, 0);
  console.log(`\n${game.meta.name}, ${numPlayers} players, ${games} games`);
  console.log(`  ${label} seat win rate ${(museWins / games).toFixed(2)} (fair share ${(1 / numPlayers).toFixed(2)})`);
  if (games > 20) console.log(`  over the first 20 games: ${(results.slice(0, 20).reduce((a, b) => a + b, 0) / 20).toFixed(2)}`);
  console.log(`  ${tally.decisions} social decisions, ${tally.overruled} overruled the bot's advice, ${tally.failures} fell back to the bot`);
  for (const line of tally.talk.slice(0, 6)) console.log(`  ${line}`);
}

async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const started = Date.now();
await matchup(liarsDice, 2, GAMES.liarsDice);
await matchup(lanternIsles, 3, GAMES.lanternIsles);
const { calls, promptTokens, completionTokens } = llm.usage;
const spend = open ? "" : `, ~$${(promptTokens * PRICE.prompt + completionTokens * PRICE.completion).toFixed(2)}`;
console.log(
  `\n${label}: ${calls} new calls (${promptTokens} prompt + ${completionTokens} completion tokens${spend}), ${llm.hits} cached, ${Math.round((Date.now() - started) / 1000)} s`,
);
