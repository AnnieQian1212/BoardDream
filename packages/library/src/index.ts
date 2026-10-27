import { randomBot, type Bot, type GameModule } from "@boarddream/engine";
import { liarsDiceBot } from "./bots/liars-dice";
import { liarsDice } from "./games/liars-dice";
import { lineUp } from "./games/line-up";
import { raceHome } from "./games/race-home";

export * from "./catalog";
export * as mechanics from "./mechanics";
export { bidProbability, liarsDiceBot } from "./bots/liars-dice";
export type { LiarsDiceMove, LiarsDiceView } from "./games/liars-dice";
export { liarsDice, lineUp, raceHome };

export const referenceGames: GameModule[] = [lineUp, raceHome, liarsDice];

/** Game-specific baseline bots; games without one play randomly. */
const referenceBots: Record<string, Bot> = {
  [liarsDice.meta.id]: liarsDiceBot(),
};

export const defaultBot = (game: GameModule): Bot => referenceBots[game.meta.id] ?? randomBot;
