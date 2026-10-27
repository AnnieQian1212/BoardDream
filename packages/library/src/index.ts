import { randomBot, type Bot, type GameModule } from "@boarddream/engine";
import { liarsDiceBot } from "./bots/liars-dice";
import { hexGame } from "./games/hex";
import { iDoubtIt } from "./games/i-doubt-it";
import { liarsDice } from "./games/liars-dice";
import { lineUp } from "./games/line-up";
import { raceHome } from "./games/race-home";
import { reversi } from "./games/reversi";
import { snakesLadders } from "./games/snakes-ladders";

export * from "./catalog";
export * as mechanics from "./mechanics";
export { bidProbability, liarsDiceBot } from "./bots/liars-dice";
export type { LiarsDiceMove, LiarsDiceView } from "./games/liars-dice";
export { hexGame, iDoubtIt, liarsDice, lineUp, raceHome, reversi, snakesLadders };

export const referenceGames: GameModule[] = [lineUp, reversi, hexGame, raceHome, snakesLadders, liarsDice, iDoubtIt];

/** Game-specific baseline bots; games without one play randomly. */
const referenceBots: Record<string, Bot> = {
  [liarsDice.meta.id]: liarsDiceBot(),
};

export const defaultBot = (game: GameModule): Bot => referenceBots[game.meta.id] ?? randomBot;
