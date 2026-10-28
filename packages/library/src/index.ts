import { heuristicBot, type Bot, type GameModule } from "@boarddream/engine";
import { fenlightBot } from "./bots/fenlight";
import { glasshouseBot } from "./bots/glasshouse";
import { highsailBot } from "./bots/highsail";
import { lanternIslesBot } from "./bots/lantern-isles";
import { liarsDiceBot } from "./bots/liars-dice";
import { wildmereBot } from "./bots/wildmere";
import { fenlight } from "./games/fenlight";
import { glasshouse } from "./games/glasshouse";
import { hexGame } from "./games/hex";
import { highsail } from "./games/highsail";
import { iDoubtIt } from "./games/i-doubt-it";
import { lanternIsles } from "./games/lantern-isles";
import { liarsDice } from "./games/liars-dice";
import { lineUp } from "./games/line-up";
import { raceHome } from "./games/race-home";
import { reversi } from "./games/reversi";
import { snakesLadders } from "./games/snakes-ladders";
import { wildmere } from "./games/wildmere";

export * from "./catalog";
export * from "./table-talk";
export * as mechanics from "./mechanics";
export { fenlightBot, suspicion } from "./bots/fenlight";
export { fenlightSides, type FenlightMove, type FenlightParams, type FenlightState } from "./games/fenlight";
export { glasshouseBot } from "./bots/glasshouse";
export { highsailBot, highsailValue } from "./bots/highsail";
export { lanternIslesBot } from "./bots/lantern-isles";
export { bidProbability, liarsDiceBot } from "./bots/liars-dice";
export { GLASSHOUSE_CARDS, GLASSHOUSE_RESOURCES } from "./games/glasshouse-cards";
export { HIGHSAIL_CHARTERS, HIGHSAIL_RESOURCES, ISLANDS } from "./games/highsail-cards";
export { highsailScore, spacesFor, type HighsailMove, type HighsailState } from "./games/highsail";
export { LANTERN_MAP, LANTERN_RESOURCES, lanternScore, type LanternMove, type LanternState } from "./games/lantern-isles";
export type { LiarsDiceMove, LiarsDiceView } from "./games/liars-dice";
export { wildmereBot, wildmereValue } from "./bots/wildmere";
export { TERRAINS, WILDMERE_RESOURCES, WILDMERE_TILES } from "./games/wildmere-tiles";
export { wildmereScore, type WildmereMove, type WildmereState } from "./games/wildmere";
export { fenlight, glasshouse, hexGame, highsail, iDoubtIt, lanternIsles, liarsDice, lineUp, raceHome, reversi, snakesLadders, wildmere };

/** Original hobby games for teens and adults: what the app offers and what generated games aim for. */
export const referenceGames: GameModule[] = [glasshouse, lanternIsles, highsail, wildmere, fenlight];

/**
 * Small classic games that exercise engine features (grids, dice, tracks, hidden hands, bluffing,
 * simultaneous play). Tests and the retrieval eval use them; the app does not offer them.
 */
export const fixtureGames: GameModule[] = [lineUp, reversi, hexGame, raceHome, snakesLadders, liarsDice, iDoubtIt];

/** Game-specific bots; every other game, generated ones included, gets the generic heuristic bot. */
const referenceBots: Record<string, Bot> = {
  [fenlight.meta.id]: fenlightBot(),
  [glasshouse.meta.id]: glasshouseBot(),
  [highsail.meta.id]: highsailBot(),
  [lanternIsles.meta.id]: lanternIslesBot(),
  [liarsDice.meta.id]: liarsDiceBot(),
  [wildmere.meta.id]: wildmereBot(),
};

const quickBot = heuristicBot();
const thoroughBot = heuristicBot({ rollouts: 6, depth: 16 });

/** The game's own bot, if it has one. */
export const ownBot = (game: GameModule): Bot | undefined => referenceBots[game.meta.id];

/** Fast enough for balance simulations of hundreds of games. */
export const defaultBot = (game: GameModule): Bot => referenceBots[game.meta.id] ?? quickBot;

/** Stronger, slower play for opponents at the table: checks its best moves with short playouts. */
export const tableBot = (game: GameModule): Bot => referenceBots[game.meta.id] ?? thoroughBot;
