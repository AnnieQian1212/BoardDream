// Muse Spark opponents against the game's own bot: does handing the social moves (offers, bids,
// calls) to Muse Spark, with the bot's move as advice, play at least as well as the bot alone?
//
//   npm run eval:opponents
import { createRng, resolveParams, type GameModule } from "@boarddream/engine";
import { lanternIsles, liarsDice, socialMoves, tableBot, tableText } from "@boarddream/library";
import { chooseMove } from "../../apps/server/src/agent/opponent";
import { config } from "../../apps/server/src/config";
import { CachedModelClient } from "../../apps/server/src/meta/cache";

const here = new URL("./", import.meta.url);
const llm = new CachedModelClient({ ...config.meta, model: config.models.designer }, new URL("cache/", here));
const PRICE = { prompt: 1.25e-6, completion: 4.25e-6 };

interface Tally {
  decisions: number;
  overruled: number;
  failures: number;
  talk: string[];
}

type Decider = (state: unknown, seat: number, recent: string[], rng: ReturnType<typeof createRng>) => Promise<unknown>;

const botDecider =
  (game: GameModule): Decider =>
  async (state, seat, _recent, rng) => {
    const view = game.view ? game.view(state, seat) : state;
    return tableBot(game)({ game, state: view, player: seat, moves: game.legalMoves(state, seat), rng });
  };

/** The same split as the web app: the bot's move unless it is social, then Muse Spark picks a social move. */
const museDecider =
  (game: GameModule, numPlayers: number, tally: Tally): Decider =>
  async (state, seat, recent, rng) => {
    const moves = game.legalMoves(state, seat);
    const view = game.view ? game.view(state, seat) : state;
    const advice = tableBot(game)({ game, state: view, player: seat, moves, rng });
    const social = socialMoves(game, state, seat, moves);
    if (!social.includes(advice)) return advice;
    const describe = (m: unknown) => game.describeMove?.(state, m, seat) ?? JSON.stringify(m);
    tally.decisions++;
    try {
      const reply = await chooseMove(llm, {
        game: game.meta.name,
        rules: game.meta.rules ?? [game.meta.summary],
        seat,
        numPlayers,
        table: tableText(game, state, seat),
        recent: recent.slice(-8),
        moves: social.map(describe),
        advice: social.indexOf(advice),
      });
      const move = social[reply.move];
      if (move !== advice) tally.overruled++;
      if (reply.say) tally.talk.push(`${describe(move)} — "${reply.say}"`);
      return move;
    } catch {
      tally.failures++;
      return advice;
    }
  };

async function play(game: GameModule, numPlayers: number, seed: number, deciders: Decider[]) {
  const rng = createRng(seed);
  let state = game.setup({ numPlayers, params: resolveParams(game.params), rng });
  const recent: string[] = [];
  for (let turn = 0; turn < 2000 && !game.isTerminal(state); turn++) {
    const [seat] = game.activePlayers(state);
    const move = await deciders[seat](state, seat, recent, rng);
    recent.push(`P${seat + 1} ${game.describeMove?.(state, move) ?? JSON.stringify(move)}`);
    state = game.applyMove(state, seat, move, rng);
  }
  return game.outcome(state).winners;
}

async function matchup(game: GameModule, numPlayers: number, games: number) {
  const tally: Tally = { decisions: 0, overruled: 0, failures: 0, talk: [] };
  let museWins = 0;
  // The Muse seat rotates so no seat order favors it.
  const results = await Promise.all(
    Array.from({ length: games }, async (_, i) => {
      const museSeat = i % numPlayers;
      const deciders = Array.from({ length: numPlayers }, (_, seat) => (seat === museSeat ? museDecider(game, numPlayers, tally) : botDecider(game)));
      const winners = await play(game, numPlayers, 1000 + i, deciders);
      return winners.includes(museSeat) ? 1 / winners.length : 0;
    }),
  );
  museWins = results.reduce((a, b) => a + b, 0);
  console.log(`\n${game.meta.name}, ${numPlayers} players, ${games} games`);
  console.log(`  Muse Spark seat win rate ${(museWins / games).toFixed(2)} (fair share ${(1 / numPlayers).toFixed(2)})`);
  console.log(`  ${tally.decisions} social decisions, ${tally.overruled} overruled the bot's advice, ${tally.failures} fell back to the bot`);
  for (const line of tally.talk.slice(0, 6)) console.log(`  ${line}`);
}

await matchup(liarsDice, 2, 20);
await matchup(lanternIsles, 3, 9);
const cost = llm.usage.promptTokens * PRICE.prompt + llm.usage.completionTokens * PRICE.completion;
console.log(`\nMuse Spark: ${llm.usage.calls} new calls (~$${cost.toFixed(2)}), ${llm.hits} cached`);
