import { createRng, randomBot, resolveParams, simulate, type GameModule } from "@boarddream/engine";

/**
 * After rules pass fuzzing (they never break), a quick playtest looks for games that work but
 * are not worth playing: over in a few moves, nearly always drawn, a seat that never wins, or
 * only one kind of move.
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
}

const kindOf = (move: unknown): string =>
  move !== null && typeof move === "object" && "type" in move ? String((move as { type: unknown }).type) : typeof move;

export function playtest(game: GameModule, games = 100): PlayStats {
  const numPlayers = Math.min(game.meta.maxPlayers, Math.max(game.meta.minPlayers, 3));
  const stats = simulate(game, { numPlayers, games, bots: new Array(numPlayers).fill(randomBot) });
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
  };
}

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
  return issues;
}
