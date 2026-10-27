import { createRng, resolveParams, simulate, type BalanceStats, type GameModule, type Params, type Rng } from "@boarddream/engine";
import { defaultBot, referenceGames } from "@boarddream/library";
import { useEffect, useState } from "react";
import { Board } from "./components/Board";
import { CreatePanel } from "./components/CreatePanel";
import { TuningPanel } from "./components/TuningPanel";

const HUMAN = 0;
const SIM_GAMES = 300;

interface Match {
  state: unknown;
  rng: Rng;
  log: string[];
}

const describe = (game: GameModule, state: unknown, player: number, move: unknown) =>
  `P${player + 1}: ${game.describeMove?.(state, move) ?? JSON.stringify(move)}`;

/** Applies the human's move, if any, then lets bots play until it is the human's turn or the game ends. */
function advance(game: GameModule, match: Match, move?: unknown): Match {
  let { state } = match;
  const log = match.log.slice();
  if (move !== undefined) {
    log.push(describe(game, state, HUMAN, move));
    state = game.applyMove(state, HUMAN, move, match.rng);
  }
  const bot = defaultBot(game);
  while (!game.isTerminal(state)) {
    const [player] = game.activePlayers(state);
    if (player === HUMAN) break;
    // TODO(day 4-5): Monte Carlo bots for perfect-information games, Muse Spark players for bluff games.
    const view = game.view ? game.view(state, player) : state;
    const botMove = bot({ game, state: view, player, moves: game.legalMoves(state, player), rng: match.rng });
    log.push(describe(game, state, player, botMove));
    state = game.applyMove(state, player, botMove, match.rng);
  }
  return { ...match, state, log };
}

function startMatch(game: GameModule, numPlayers: number, params: Params): Match {
  const rng = createRng(Date.now() >>> 0);
  return advance(game, { state: game.setup({ numPlayers, params, rng }), rng, log: [] });
}

export function App() {
  const [games, setGames] = useState<GameModule[]>(referenceGames);
  const [game, setGame] = useState<GameModule>(referenceGames[0]);
  const [numPlayers, setNumPlayers] = useState(game.meta.minPlayers);
  const [params, setParams] = useState<Params>(() => resolveParams(game.params));
  const [match, setMatch] = useState(() => startMatch(game, numPlayers, params));
  const [stats, setStats] = useState<BalanceStats>();

  // Re-simulate whenever the rules or sliders change. TODO(day 4): move into a Web Worker.
  useEffect(() => {
    setStats(undefined);
    const bots = new Array(numPlayers).fill(defaultBot(game));
    const timer = setTimeout(() => setStats(simulate(game, { numPlayers, params, games: SIM_GAMES, bots })), 150);
    return () => clearTimeout(timer);
  }, [game, numPlayers, params]);

  function configure(nextGame: GameModule, nextPlayers: number, nextParams: Params) {
    setGame(nextGame);
    setNumPlayers(nextPlayers);
    setParams(nextParams);
    setMatch(startMatch(nextGame, nextPlayers, nextParams));
  }
  const selectGame = (g: GameModule) => configure(g, g.meta.minPlayers, resolveParams(g.params));

  const over = game.isTerminal(match.state);
  const myTurn = !over && game.activePlayers(match.state)[0] === HUMAN;
  const targets = new Map<string, unknown>();
  const otherMoves: unknown[] = [];
  for (const move of myTurn ? game.legalMoves(match.state, HUMAN) : []) {
    const cell = game.moveTarget?.(match.state, move);
    if (cell) targets.set(cell, move);
    else otherMoves.push(move);
  }
  const geometry = game.geometry?.(match.state, HUMAN);
  const play = (move: unknown) => setMatch(advance(game, match, move));

  let status = myTurn ? "Your turn" : "Waiting for opponents";
  if (over) {
    const { winners } = game.outcome(match.state);
    status =
      winners.length === 0 ? "Draw" : winners.includes(HUMAN) ? "You win!" : `Player ${winners.map((w) => w + 1).join(", ")} wins`;
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>BoardDream</h1>
        <select value={games.indexOf(game)} onChange={(e) => selectGame(games[Number(e.target.value)])}>
          {games.map((g, i) => (
            <option key={i} value={i}>
              {g.meta.name}
            </option>
          ))}
        </select>
      </header>

      <main className="layout">
        <CreatePanel
          onGenerated={(g) => {
            setGames([...games, g]);
            selectGame(g);
          }}
        />

        <section className="panel play">
          <div className="status">
            <strong>{status}</strong>
            <button onClick={() => setMatch(startMatch(game, numPlayers, params))}>New game</button>
          </div>
          {geometry && (
            <Board geometry={geometry} targets={new Set(targets.keys())} onCell={(id) => targets.has(id) && play(targets.get(id))} />
          )}
          {otherMoves.length > 0 && (
            <div className="moves">
              {otherMoves.map((move, i) => (
                <button key={i} onClick={() => play(move)}>
                  {game.describeMove?.(match.state, move) ?? JSON.stringify(move)}
                </button>
              ))}
            </div>
          )}
          <ol className="log">
            {match.log.slice(-6).map((line, i) => (
              <li key={match.log.length - i}>{line}</li>
            ))}
          </ol>
        </section>

        <TuningPanel
          game={game}
          numPlayers={numPlayers}
          params={params}
          stats={stats}
          onChange={(players, nextParams) => configure(game, players, nextParams)}
        />
      </main>
    </div>
  );
}
