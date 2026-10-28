// Balance and profile of the original reference games at their default settings, written to
// apps/web/src/reference-stats.json for the results page. Everything runs locally: no model calls.
//
//   npm run eval:reference                 # every reference game
//   npm run eval:reference -- fenlight     # refresh some games, keep the rest of the file
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { measureProfile, playMatch, scoreProfile, simulate, type GameModule } from "@boarddream/engine";
import { defaultBot, ownBot, referenceGames, tableBot } from "@boarddream/library";

const GAMES = 600;
const out = new URL("../../apps/web/src/reference-stats.json", import.meta.url);
const only = process.argv[2]?.split(",");
const previous: { id: string }[] = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : [];

/** Up to three table sizes, from the smallest the game allows. */
const tableSizes = (game: GameModule) =>
  Array.from({ length: game.meta.maxPlayers - game.meta.minPlayers + 1 }, (_, i) => game.meta.minPlayers + i)
    .filter((n) => n >= 2)
    .slice(0, 3);

interface BalanceRow {
  numPlayers: number;
  games: number;
  /** Ordinary games: each seat's win rate, first player first. */
  winRateBySeat?: number[];
  drawRate?: number;
  medianTurns?: number;
  /** Hidden-role games: the share of games the larger side wins. */
  majorityWins?: number;
}

function measure(game: GameModule) {
  const started = Date.now();
  // Hidden roles are dealt at random, so a seat's win rate says little; what matters is which side wins.
  const hiddenRoles = game.meta.mode === "hidden-role";
  const balance = tableSizes(game).map((numPlayers): BalanceRow => {
    if (hiddenRoles) return { numPlayers, games: GAMES, majorityWins: majorityWins(game, numPlayers) };
    const stats = simulate(game, { numPlayers, games: GAMES, bots: new Array(numPlayers).fill(defaultBot(game)) });
    return { numPlayers, games: stats.games, winRateBySeat: stats.winRateBySeat, drawRate: stats.drawRate, medianTurns: stats.medianTurns };
  });
  const measured = ownBot(game) !== undefined || game.meta.family !== "bluff";
  const profile = scoreProfile(measureProfile(game, { games: 20, planner: tableBot(game), plannerGames: measured ? 30 : 0 }));
  const sizes = balance
    .map((b) => `${b.numPlayers}p ${b.majorityWins !== undefined ? `majority ${Math.round(b.majorityWins * 100)}%` : (b.winRateBySeat ?? []).map((r) => Math.round(r * 100)).join("/")}`)
    .join(", ");
  console.log(`${game.meta.name}: ${sizes}; C ${profile.complexity} S ${profile.strategy} L ${profile.luck} I ${profile.interaction} (${Math.round((Date.now() - started) / 1000)} s)`);
  return { id: game.meta.id, name: game.meta.name, family: game.meta.family, mode: game.meta.mode, balance, profile };
}

/** Share of games the larger side wins, i.e. more than half the table is among the winners. */
function majorityWins(game: GameModule, numPlayers: number): number {
  let wins = 0;
  for (let i = 0; i < GAMES; i++) {
    const { outcome } = playMatch(game, { numPlayers, seed: 1 + i, bots: new Array(numPlayers).fill(defaultBot(game)) });
    if (outcome.winners.length * 2 > numPlayers) wins++;
  }
  return wins / GAMES;
}

const rows = referenceGames.map((game) => (!only || only.includes(game.meta.id) ? measure(game) : previous.find((p) => p.id === game.meta.id) ?? measure(game)));
writeFileSync(out, JSON.stringify(rows, null, 2) + "\n");
