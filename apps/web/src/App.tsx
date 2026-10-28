import { createRng, resolveParams, type BalanceStats, type GameModule, type Params, type Rng } from "@boarddream/engine";
import { referenceGames } from "@boarddream/library";
import { Maximize2, Minimize2, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { collectCards, startingGeometry, useArt } from "./art";
import { ArtPanel } from "./components/ArtPanel";
import { CreatePanel } from "./components/CreatePanel";
import { LogPanel, type LogEntry } from "./components/LogPanel";
import { Table } from "./components/Table";
import { TuningPanel } from "./components/TuningPanel";
import { generatedSource, loadGeneratedGame } from "./generated";
import { decide, type Decision } from "./opponents";
import type { SimRequest } from "./sim.worker";
import { Tabletop } from "./three/Tabletop";

const HUMAN = 0;
const SIM_GAMES = 200;
/** Pause between bot moves so a table full of bots is watchable. */
const BOT_DELAY = 650;

// ?game=<id> opens a specific game; ?watch lets bots play every seat (screenshots, video b-roll);
// ?quality=lowest|low|medium|high pins the 3D render quality; ?flat uses the 2D table instead of WebGL.
const query = new URLSearchParams(window.location.search);
const WATCH = query.has("watch");
const FLAT = query.has("flat") || !hasWebGL();
/** Screen space the floating side panels, top bar and move bar cover. */
const PANEL_INSET = 326;
const TOP_INSET = 66;
const BOTTOM_INSET = 92;

function hasWebGL(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}
const initialGame = referenceGames.find((g) => g.meta.id === query.get("game")) ?? referenceGames[0];

interface Match {
  state: unknown;
  rng: Rng;
  log: LogEntry[];
}

function applyMove(game: GameModule, match: Match, seat: number, move: unknown, say?: string): Match {
  // Described from the human's seat, so rivals' hidden cards stay hidden in the log.
  const text = game.describeMove?.(match.state, move, HUMAN) ?? JSON.stringify(move);
  const state = game.applyMove(match.state, seat, move, match.rng);
  const id = (match.log.at(-1)?.id ?? 0) + 1;
  return { ...match, state, log: [...match.log.slice(-60), { id, seat, text, say }] };
}

function startMatch(game: GameModule, numPlayers: number, params: Params): Match {
  const rng = createRng(Date.now() >>> 0);
  return { state: game.setup({ numPlayers, params, rng }), rng, log: [] };
}

/** Genre games read best with three at the table; abstracts with their minimum. */
const defaultPlayers = (game: GameModule) =>
  game.meta.family === "engine" || game.meta.family === "map"
    ? Math.min(game.meta.maxPlayers, Math.max(game.meta.minPlayers, 3))
    : game.meta.minPlayers;

export function App() {
  const [games, setGames] = useState<GameModule[]>(referenceGames);
  const [game, setGame] = useState<GameModule>(initialGame);
  const [numPlayers, setNumPlayers] = useState(() => defaultPlayers(initialGame));
  const [params, setParams] = useState<Params>(() => resolveParams(initialGame.params));
  const [match, setMatch] = useState(() => startMatch(game, numPlayers, params));
  const [stats, setStats] = useState<BalanceStats>();
  // Muse Spark (Open, when the server hosts it) plays the social moves: offers, bids, bluffs.
  const [muse, setMuse] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [opponentModel, setOpponentModel] = useState<string>();
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json() as Promise<{ hasApiKey?: boolean; opponentModel?: string }>)
      .then((health) => {
        setHasApiKey(Boolean(health.hasApiKey));
        setOpponentModel(health.opponentModel);
        setMuse(Boolean(health.opponentModel) && !query.has("bots"));
      })
      .catch(() => {});
  }, []);
  const { art, painting, paint, board, boardStep, paintBoard } = useArt(game);
  const cardCount = useMemo(() => collectCards(game).length, [game]);
  const hasBoard = useMemo(() => (startingGeometry(game)?.cells.some((c) => c.kind !== "label") ?? false), [game]);
  // Games generated earlier on this machine join the picker; ?game=<id> can open one of them.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = (await (await fetch("/api/games")).json()) as { id: string; rules?: string[] }[];
      const loaded: GameModule[] = [];
      for (const saved of list) {
        try {
          loaded.push(loadGeneratedGame(await (await fetch(`/api/games/${saved.id}`)).text(), saved.id, saved.rules));
        } catch {
          // A game that no longer loads (e.g. after an engine change) stays out of the picker.
        }
      }
      if (cancelled || loaded.length === 0) return;
      setGames((current) => [...current, ...loaded.filter((g) => !current.some((c) => c.meta.id === g.meta.id))]);
      const wanted = loaded.find((g) => g.meta.id === query.get("game"));
      if (wanted) selectGame(wanted);
    })().catch(() => {
      // No server running: reference games only.
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Focus mode hides the side panels so the table fills the screen (press F).
  const [focus, setFocus] = useState(WATCH || window.innerWidth < 1100);
  const insets = useMemo(
    () => ({ left: focus ? 0 : PANEL_INSET, right: focus ? 0 : PANEL_INSET, top: TOP_INSET, bottom: BOTTOM_INSET }),
    [focus],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (!typing && e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey) setFocus((f) => !f);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Bots take their turns one at a time. Muse Spark may take a few seconds on a social move; a
  // decision for a state that has since changed (new game, undo) is dropped.
  useEffect(() => {
    if (game.isTerminal(match.state)) return;
    const [seat] = game.activePlayers(match.state);
    if (seat === HUMAN && !WATCH) return;
    let cancelled = false;
    const recent = match.log.map((e) => `${e.seat === seat ? "You" : `P${e.seat + 1}`} ${e.text}${e.say ? ` ("${e.say}")` : ""}`);
    const timer = setTimeout(async () => {
      const decision: Decision = await decide(game, match.state, seat, numPlayers, recent, match.rng, muse);
      if (!cancelled) setMatch((current) => (current === match ? applyMove(game, match, seat, decision.move, decision.say) : current));
    }, BOT_DELAY);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [game, match, muse, numPlayers]);

  // Re-simulate in a worker whenever the rules or sliders change; a new setting cancels the old run.
  useEffect(() => {
    setStats(undefined);
    const worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<BalanceStats>) => setStats(event.data);
    const request: SimRequest = { gameId: game.meta.id, source: generatedSource(game), numPlayers, params, games: SIM_GAMES };
    // Debounced, so dragging a slider starts one run when it settles.
    const timer = setTimeout(() => worker.postMessage(request), 200);
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
  }, [game, numPlayers, params]);

  function configure(nextGame: GameModule, nextPlayers: number, nextParams: Params) {
    setGame(nextGame);
    setNumPlayers(nextPlayers);
    setParams(nextParams);
    setMatch(startMatch(nextGame, nextPlayers, nextParams));
  }
  const selectGame = (g: GameModule) => configure(g, defaultPlayers(g), resolveParams(g.params));

  // The latest table talk among the last few moves.
  const spoken = match.log.slice(-4).findLast((e) => e.say);
  const speech = spoken ? { id: spoken.id, seat: spoken.seat, text: spoken.say! } : undefined;

  const tableProps = {
    game,
    state: match.state,
    numPlayers,
    human: HUMAN,
    onMove: (move: unknown) => setMatch(applyMove(game, match, HUMAN, move)),
    onRestart: () => setMatch(startMatch(game, numPlayers, params)),
  };
  const tableKey = `${games.indexOf(game)}-${numPlayers}`;

  return (
    <div className={["app", focus && "focus"].filter(Boolean).join(" ")}>
      {FLAT ? (
        <div className="flat-stage" style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
          <Table key={tableKey} {...tableProps} />
        </div>
      ) : (
        <Tabletop key={tableKey} {...tableProps} insets={insets} speech={speech} art={art} boardPaint={board?.paint} />
      )}

      <header className="topbar">
        <div className="brand">
          <BrandMark />
          BoardDream
        </div>
        <label className="picker">
          <span>Now playing</span>
          <select value={games.indexOf(game)} onChange={(e) => selectGame(games[Number(e.target.value)])}>
            {games.map((g, i) => (
              <option key={i} value={i}>
                {g.meta.name}
              </option>
            ))}
          </select>
        </label>
        <span className="tagline">{game.meta.summary}</span>
        <button
          type="button"
          className={["ghost", muse && "on"].filter(Boolean).join(" ")}
          onClick={() => setMuse(!muse)}
          disabled={!opponentModel}
          title={opponentModel ? `${opponentModel} plays the opponents' trades, bids and bluffs` : "Needs a model API key on the server"}
        >
          <Sparkles size={15} /> {muse ? "Muse opponents" : "Bot opponents"}
        </button>
        <button type="button" className="ghost" onClick={() => setFocus(!focus)} title="Toggle the side panels (F)">
          {focus ? <Minimize2 size={15} /> : <Maximize2 size={15} />} {focus ? "Panels" : "Focus"}
        </button>
        <button type="button" className="ghost" onClick={() => setMatch(startMatch(game, numPlayers, params))}>
          <RotateCcw size={15} /> New game
        </button>
      </header>

      <aside className="sidebar left">
        <CreatePanel
          onGenerated={(g) => {
            setGames([...games, g]);
            selectGame(g);
          }}
        />
      </aside>

      <aside className="sidebar right">
        <TuningPanel
          game={game}
          numPlayers={numPlayers}
          params={params}
          stats={stats}
          simGames={SIM_GAMES}
          onChange={(players, nextParams) => configure(game, players, nextParams)}
        />
        {(cardCount > 0 || hasBoard) && (
          <ArtPanel
            cards={cardCount}
            painted={art.size}
            painting={painting}
            available={hasApiKey}
            onPaint={() => void paint()}
            board={hasBoard ? { report: board?.report, step: boardStep, onPaint: () => void paintBoard() } : undefined}
          />
        )}
        <LogPanel entries={match.log} human={HUMAN} />
      </aside>
    </div>
  );
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="brand-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6d98b" />
          <stop offset="100%" stopColor="#d99a2b" />
        </linearGradient>
      </defs>
      <path d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25Z" fill="url(#brand-gold)" />
      <path d="M16 9.5l1.9 4.6 4.6 1.9-4.6 1.9L16 22.5l-1.9-4.6-4.6-1.9 4.6-1.9Z" fill="#2a2520" />
    </svg>
  );
}
