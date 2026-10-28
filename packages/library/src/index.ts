import { heuristicBot, type Bot, type GameModule } from "@boarddream/engine";
import { glasshouseBot } from "./bots/glasshouse";
import { lanternIslesBot } from "./bots/lantern-isles";
import { liarsDiceBot } from "./bots/liars-dice";
import { glasshouse } from "./games/glasshouse";
import { hexGame } from "./games/hex";
import { iDoubtIt } from "./games/i-doubt-it";
import { lanternIsles } from "./games/lantern-isles";
import { liarsDice } from "./games/liars-dice";
import { lineUp } from "./games/line-up";
import { raceHome } from "./games/race-home";
import { reversi } from "./games/reversi";
import { snakesLadders } from "./games/snakes-ladders";

export * from "./catalog";
export * from "./table-talk";
export * as mechanics from "./mechanics";
export { glasshouseBot } from "./bots/glasshouse";
export { lanternIslesBot } from "./bots/lantern-isles";
export { bidProbability, liarsDiceBot } from "./bots/liars-dice";
export { GLASSHOUSE_CARDS, GLASSHOUSE_RESOURCES } from "./games/glasshouse-cards";
export { LANTERN_MAP, LANTERN_RESOURCES, lanternScore, type LanternMove, type LanternState } from "./games/lantern-isles";
export type { LiarsDiceMove, LiarsDiceView } from "./games/liars-dice";
export { glasshouse, hexGame, iDoubtIt, lanternIsles, liarsDice, lineUp, raceHome, reversi, snakesLadders };

/** Genre references first: they are what the app opens with. */
export const referenceGames: GameModule[] = [glasshouse, lanternIsles, lineUp, reversi, hexGame, raceHome, snakesLadders, liarsDice, iDoubtIt];

/** Game-specific bots; every other game, generated ones included, gets the generic heuristic bot. */
const referenceBots: Record<string, Bot> = {
  [glasshouse.meta.id]: glasshouseBot(),
  [lanternIsles.meta.id]: lanternIslesBot(),
  [liarsDice.meta.id]: liarsDiceBot(),
};

const quickBot = heuristicBot();
const thoroughBot = heuristicBot({ rollouts: 6, depth: 16 });

/** Fast enough for balance simulations of hundreds of games. */
export const defaultBot = (game: GameModule): Bot => referenceBots[game.meta.id] ?? quickBot;

/** Stronger, slower play for opponents at the table: checks its best moves with short playouts. */
export const tableBot = (game: GameModule): Bot => referenceBots[game.meta.id] ?? thoroughBot;
