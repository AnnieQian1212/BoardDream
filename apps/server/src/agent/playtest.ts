import { createRng, heuristicBot, randomBot, resolveParams, simulate, type GameModule } from "@boarddream/engine";

/**
 * After rules pass fuzzing (they never break), a quick playtest looks for games that work but
 * are not worth playing: over in a few moves, nearly always drawn, a seat that never wins, only
 * one kind of move, or decisions that barely change who wins.
 */

export interface PlayStats {
  numPlayers: number;
  games: number;
  medianTurns: number;
  drawRate: number;
  winRateBySeat: number[];
  truncatedRate: number;
  /** Distinct move kinds seen (the "type" field of object moves, or the value's type). */
  moveKinds: string[];
  /** Share of turns where the mover had more than one legal move. */
  choiceRate: number;
  /**
   * Share of games a player who plans ahead (short playouts) wins against random opponents, over
   * every seat. Measured for competitive games without bluffing, where it shows whether skill pays.
   */
  plannerWinRate?: number;
}

export interface PlaytestOptions {
  games?: number;
  /** Games the planner plays, spread over every seat. */
  plannerGames?: number;
  /** Called with each simulated game's seed before it starts (heartbeats for the checker's watchdog). */
  onGame?(seed: number): void;
}

const kindOf = (move: unknown): string =>
  move !== null && typeof move === "object" && "type" in move ? String((move as { type: unknown }).type) : typeof move;

/** Bluffing is what the planner cannot do, so in those games its win rate says nothing about skill. */
const skillMeasurable = (game: GameModule) => game.meta.mode === "competitive" && game.meta.family !== "bluff";

/** Playtests seat three players when the game allows it. */
export const playtestPlayers = (game: GameModule) => Math.min(game.meta.maxPlayers, Math.max(game.meta.minPlayers, 3));

export function playtest(game: GameModule, opts: PlaytestOptions = {}): PlayStats {
  const { games = 100, plannerGames = 30, onGame } = opts;
  const numPlayers = playtestPlayers(game);
  const stats = simulate(game, { numPlayers, games, bots: new Array(numPlayers).fill(randomBot), onGame });
  // Replay a few random games by hand to see how many real choices players get.
  const kinds = new Set<string>();
  let turns = 0;
  let choices = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const rng = createRng(seed);
    let state = game.setup({ numPlayers, params: resolveParams(game.params), rng });
    for (let step = 0; step < 1000 && !game.isTerminal(state); step++) {
      const [seat] = game.activePlayers(state);
      const moves = game.legalMoves(state, seat);
      turns++;
      if (moves.length > 1) choices++;
      const move = rng.pick(moves);
      kinds.add(kindOf(move));
      state = game.applyMove(state, seat, move, rng);
    }
  }
  return {
    numPlayers,
    games: stats.games,
    medianTurns: stats.medianTurns,
    drawRate: stats.drawRate,
    winRateBySeat: stats.winRateBySeat,
    truncatedRate: stats.truncatedRate,
    moveKinds: [...kinds].sort(),
    choiceRate: turns ? choices / turns : 0,
    plannerWinRate: skillMeasurable(game) && plannerGames > 0 ? plannerWinRate(game, numPlayers, plannerGames, onGame) : undefined,
  };
}

/** The planner takes each seat in turn against random players. */
function plannerWinRate(game: GameModule, numPlayers: number, games: number, onGame?: (seed: number) => void): number | undefined {
  const planner = heuristicBot({ rollouts: 6, depth: 16 });
  let wins = 0;
  let played = 0;
  for (let seat = 0; seat < numPlayers; seat++) {
    const bots = Array.from({ length: numPlayers }, (_, i) => (i === seat ? planner : randomBot));
    const stats = simulate(game, { numPlayers, games: Math.ceil(games / numPlayers), seed: 1000 + 100 * seat, bots, onGame });
    wins += stats.winRateBySeat[seat] * stats.games;
    played += stats.games;
  }
  return played ? wins / played : undefined;
}

/**
 * How far the planner's win rate sits between the fair share (0) and always winning (1). In the
 * reference games it is 0.50-0.70; in a pure dice race it is about 0.
 */
export const skillEdge = (stats: PlayStats): number | undefined =>
  stats.plannerWinRate === undefined ? undefined : (stats.plannerWinRate - 1 / stats.numPlayers) / (1 - 1 / stats.numPlayers);

/** Design problems worth a repair round, in words the designer model can act on. */
export function playIssues(stats: PlayStats, mode: GameModule["meta"]["mode"]): string[] {
  const issues: string[] = [];
  if (stats.medianTurns < 3 * stats.numPlayers) {
    issues.push(`games are over too fast: the median game lasts ${stats.medianTurns} moves with ${stats.numPlayers} players`);
  }
  // In cooperative games an empty winner list is a loss, not a draw.
  if (mode === "competitive" && stats.drawRate > 0.6) issues.push(`${Math.round(stats.drawRate * 100)}% of random games end in a draw or a shared result`);
  if (stats.truncatedRate > 0.05) issues.push(`${Math.round(stats.truncatedRate * 100)}% of random games hit the engine's turn cap without ending`);
  if (mode === "competitive" && stats.games >= 50) {
    const never = stats.winRateBySeat.flatMap((rate, seat) => (rate === 0 ? [seat + 1] : []));
    if (never.length > 0) issues.push(`seat ${never.join(" and ")} never won in ${stats.games} random games`);
  }
  if (stats.choiceRate < 0.3) {
    issues.push(`players have a real choice on only ${Math.round(stats.choiceRate * 100)}% of turns; most turns offer a single legal move`);
  }
  const edge = skillEdge(stats);
  const fair = 1 / stats.numPlayers;
  if (edge !== undefined && stats.plannerWinRate! < 0.75 * fair) {
    // Planning by the standings loses to random play: the standings point the wrong way.
    issues.push(
      `the mid-game scores mislead: a player who plans by the standings in outcome(state).scores wins only ${Math.round(stats.plannerWinRate! * 100)}% of ${stats.numPlayers}-player games against random opponents, below the fair share of ${Math.round(fair * 100)}%; make those scores count what decides the game, e.g. majorities, sets and end-game bonuses as if they scored now`,
    );
  } else if (edge !== undefined && edge < 0.25) {
    issues.push(
      `decisions barely matter: a player who plans ahead wins ${Math.round(stats.plannerWinRate! * 100)}% of ${stats.numPlayers}-player games against random opponents, close to the fair share of ${Math.round(100 / stats.numPlayers)}%`,
    );
  }
  return issues;
}
