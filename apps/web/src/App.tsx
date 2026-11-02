import { createRng, resolveParams, type BalanceStats, type GameModule, type GameProfile, type Params, type Rng } from "@boarddream/engine";
import { referenceGames } from "@boarddream/library";
import { BarChart3, BookOpen, ChevronsLeft, ChevronsRight, LayoutGrid, Maximize2, Minimize2, Printer, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collectCards, startingGeometry, useArt } from "./art";
import { ArtPanel } from "./components/ArtPanel";
import { CreatePanel } from "./components/CreatePanel";
import { GameLibrary } from "./components/GameLibrary";
import { GenerationStage } from "./components/GenerationStage";
import { GenerationSteps } from "./components/GenerationSteps";
import { LogPanel, type LogEntry } from "./components/LogPanel";
import { Table } from "./components/Table";
import { ProfilePanel } from "./components/ProfilePanel";
import { PrintSheet } from "./components/PrintSheet";
import { ResultsPage } from "./components/ResultsPage";
import { RevisePanel } from "./components/RevisePanel";
import { RulesCard } from "./components/RulesCard";
import { TableGuard } from "./components/TableGuard";
import { TuningPanel } from "./components/TuningPanel";
import { deleteGeneratedGame, generatedSource, savedGames } from "./generated";
import { useSidePanels } from "./sidePanels";
import { useGeneration } from "./generation";
import { decide, type Decision } from "./opponents";
import type { ProfileRequest } from "./profile.worker";
import type { SimRequest } from "./sim.worker";
import { BATTLE_SECONDS } from "./three/Battle3D";
import { Tabletop } from "./three/Tabletop";

const HUMAN = 0;
const SIM_GAMES = 200;
/** Pause between bot moves so a table full of bots is watchable. */
const BOT_DELAY = 650;
/** Bots playing a draft while it is checked move a little faster, to show more of it. */
const PREVIEW_DELAY = 420;

// ?game=<id> opens a specific game; ?watch lets bots play every seat (screenshots, video b-roll);
// ?quality=lowest|low|medium|high pins the 3D render quality; ?flat uses the 2D table instead of WebGL.
const query = new URLSearchParams(window.location.search);
const WATCH = query.has("watch");
const FLAT = query.has("flat") || !hasWebGL();
/** Screen space the floating side panels, top bar and move bar cover. */
const PANEL_INSET = 326;
/** Room left for a folded panel's tab at the screen's edge. */
const TAB_INSET = 44;
const TOP_INSET = 66;
const BOTTOM_INSET = 92;

function hasWebGL(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}
/** A visitor first sees a game with a painted board, the table at its best. */
const FIRST_GAME = "lantern-isles";
const firstGame = referenceGames.find((g) => g.meta.id === FIRST_GAME) ?? referenceGames[0];
const initialGame = referenceGames.find((g) => g.meta.id === query.get("game")) ?? firstGame;

/** A logged move, with the state it was made from so each seat can have it described from its own view. */
interface MatchEntry extends LogEntry {
  before: unknown;
  move: unknown;
}

interface Match {
  state: unknown;
  rng: Rng;
  log: MatchEntry[];
}

function applyMove(game: GameModule, match: Match, seat: number, move: unknown, say?: string): Match {
  // Described from the human's seat, so rivals' hidden cards stay hidden in the log.
  const text = game.describeMove?.(match.state, move, HUMAN) ?? JSON.stringify(move);
  const state = game.applyMove(match.state, seat, move, match.rng);
  const id = (match.log.at(-1)?.id ?? 0) + 1;
  return { ...match, state, log: [...match.log.slice(-60), { id, seat, text, say, before: match.state, move }] };
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
  const [results, setResults] = useState(query.has("results"));
  const [library, setLibrary] = useState(query.has("games"));
  const [printing, setPrinting] = useState(false);
  // The rules card opens the first time a game is played in this browser (not while bots play alone).
  const [rulesOpen, setRulesOpen] = useState(false);
  useEffect(() => setRulesOpen(!WATCH && !query.has("results") && !rulesSeen(game.meta.id)), [game]);
  const closeRules = () => {
    markRulesSeen(game.meta.id);
    setRulesOpen(false);
  };
  const [profile, setProfile] = useState<{ profile?: GameProfile; pending: boolean; error?: string }>({ pending: true });
  // Muse Spark (Open, when the server hosts it) plays the social moves: offers, bids, bluffs.
  const [muse, setMuse] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [opponentModel, setOpponentModel] = useState<string>();
  const [canGenerate, setCanGenerate] = useState(false);
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json() as Promise<{ hasApiKey?: boolean; canGenerate?: boolean; opponentModel?: string }>)
      .then((health) => {
        setHasApiKey(Boolean(health.hasApiKey));
        setCanGenerate(Boolean(health.canGenerate));
        setOpponentModel(health.opponentModel);
        setMuse(Boolean(health.opponentModel) && !query.has("bots"));
      })
      .catch(() => {});
  }, []);
  const { art, painting, paint, board, boardStep, paintBoard } = useArt(game);
  const cardCount = useMemo(() => collectCards(game).length, [game]);
  const hasBoard = useMemo(() => (startingGeometry(game)?.cells.some((c) => c.kind !== "label") ?? false), [game]);
  // Games generated earlier (bundled demo games, and the server's when one runs) join the picker;
  // ?game=<id> can open one of them.
  useEffect(() => {
    let cancelled = false;
    void savedGames().then((loaded) => {
      if (cancelled || loaded.length === 0) return;
      setGames((current) => [...current, ...loaded.filter((g) => !current.some((c) => c.meta.id === g.meta.id))]);
      const wanted = loaded.find((g) => g.meta.id === query.get("game"));
      if (wanted) selectGame(wanted);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Each side panel folds to a tab at the screen's edge, giving the table its room; F folds or
  // opens both.
  const { open: sides, toggle: toggleSide, toggleBoth: toggleSides } = useSidePanels(!WATCH && window.innerWidth >= 1100);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (!typing && e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey) toggleSides();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSides]);

  // A game being made. Once it is ready it joins the picker and opens.
  const onReady = useCallback((g: GameModule) => {
    setGames((current) => [...current, g]);
    configure(g, defaultPlayers(g), resolveParams(g.params));
  }, []);
  const { generation, start: generate, cancel: closeGeneration } = useGeneration(onReady);
  const generating = Boolean(generation && !generation.done && !generation.error);
  // While its rules are checked, bots play the newest draft on the table: the board and cards appear
  // as soon as they exist. A draft that throws stops; the next one starts fresh.
  const draft = generating ? generation?.draft : undefined;
  const [preview, setPreview] = useState<{ game: GameModule; match: Match; stuck?: boolean }>();
  // The table that last failed to draw.
  const [unrenderable, setUnrenderable] = useState<string>();
  useEffect(() => {
    if (!draft) return setPreview(undefined);
    try {
      setPreview({ game: draft, match: startMatch(draft, defaultPlayers(draft), resolveParams(draft.params)) });
    } catch {
      setPreview(undefined);
    }
  }, [draft]);
  useEffect(() => {
    if (!preview || preview.stuck) return;
    const { game: g, match: m } = preview;
    const timer = setTimeout(() => {
      try {
        if (g.isTerminal(m.state)) return setPreview({ game: g, match: startMatch(g, defaultPlayers(g), resolveParams(g.params)) });
        const [seat] = g.activePlayers(m.state);
        const move = m.rng.pick(g.legalMoves(m.state, seat));
        setPreview((current) => (current?.match === m ? { game: g, match: applyMove(g, m, seat, move) } : current));
      } catch {
        setPreview((current) => (current?.match === m ? { ...current, stuck: true } : current));
      }
    }, g.isTerminal(m.state) ? 1800 : PREVIEW_DELAY);
    return () => clearTimeout(timer);
  }, [preview]);

  // While a game is made, its steps take the left column, the stage the rest; the right panels,
  // about the game that was on the table, step aside until the new one is ready.
  const making = Boolean(generation);
  const leftOpen = sides.left || making;
  const rightOpen = sides.right && !making;
  const insets = useMemo(
    () => ({ left: leftOpen ? PANEL_INSET : TAB_INSET, right: rightOpen ? PANEL_INSET : making ? 0 : TAB_INSET, top: TOP_INSET, bottom: BOTTOM_INSET }),
    [leftOpen, rightOpen, making],
  );

  // Bots take their turns one at a time. Muse Spark may take a few seconds on a social move; a
  // decision for a state that has since changed (new game, undo) is dropped.
  useEffect(() => {
    if (game.isTerminal(match.state) || generating) return;
    const [seat] = game.activePlayers(match.state);
    if (seat === HUMAN && !WATCH) return;
    let cancelled = false;
    // Each opponent hears the moves as its own seat saw them, never the human's secret choices.
    const recent = match.log.map((e) => {
      const text = game.describeMove?.(e.before, e.move, seat) ?? e.text;
      return `${e.seat === seat ? "You" : `P${e.seat + 1}`} ${text}${e.say ? ` ("${e.say}")` : ""}`;
    });
    // A move that fought a battle is played out on the table first.
    const battleOf = (state: unknown) => {
      try {
        return game.geometry?.(state, HUMAN)?.battle?.id;
      } catch {
        return undefined;
      }
    };
    const last = match.log.at(-1);
    const fought = last !== undefined && battleOf(match.state) !== undefined && battleOf(match.state) !== battleOf(last.before);
    const timer = setTimeout(
      async () => {
        const decision: Decision = await decide(game, match.state, seat, numPlayers, recent, match.rng, muse);
        if (!cancelled) setMatch((current) => (current === match ? applyMove(game, match, seat, decision.move, decision.say) : current));
      },
      BOT_DELAY + (fought ? BATTLE_SECONDS * 1000 : 0),
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [game, match, muse, numPlayers, generating]);

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

  // The profile is measured in its own worker: its planner games take longer than a balance run.
  useEffect(() => {
    setProfile({ pending: true });
    const worker = new Worker(new URL("./profile.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ profile?: GameProfile; pending?: boolean; error?: string }>) =>
      setProfile((current) => ({ profile: event.data.profile ?? current.profile, pending: event.data.pending ?? false, error: event.data.error }));
    const request: ProfileRequest = { gameId: game.meta.id, source: generatedSource(game), numPlayers, params };
    const timer = setTimeout(() => worker.postMessage(request), 400);
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
  // A deleted generated game leaves the picker; if it was on the table, the first game takes its place.
  const removeGame = (doomed: GameModule) => {
    void deleteGeneratedGame(doomed.meta.id);
    setGames((current) => current.filter((g) => g !== doomed));
    if (game === doomed) selectGame(firstGame);
  };


  // The latest table talk among the last few moves.
  const spoken = match.log.slice(-4).findLast((e) => e.say);
  const speech = spoken ? { id: spoken.id, seat: spoken.seat, text: spoken.say! } : undefined;

  const tableProps = preview
    ? { game: preview.game, state: preview.match.state, numPlayers: defaultPlayers(preview.game), human: HUMAN, onMove: () => {}, onRestart: () => {} }
    : {
        game,
        state: match.state,
        numPlayers,
        human: HUMAN,
        onMove: (move: unknown) => setMatch(applyMove(game, match, HUMAN, move)),
        onRestart: () => setMatch(startMatch(game, numPlayers, params)),
      };
  const tableKey = preview ? `draft-${preview.game.meta.id}` : `${games.indexOf(game)}-${numPlayers}`;
  // A draft with a fault (the playtest failed it, it threw while bots played it, or the table could
  // not draw it) leaves the table; the design sheet comes back until the next draft runs.
  const draftFailed = Boolean(
    preview && (preview.stuck || unrenderable === tableKey || generation?.checks.some((c) => c.attempt === generation.draftAttempt && !c.ok)),
  );
  const showDraft = Boolean(preview) && !draftFailed;

  return (
    <div className={["app", !leftOpen && "left-folded", !rightOpen && "right-folded", making && "making"].filter(Boolean).join(" ")}>
      {generation && <GenerationStage generation={generation} previewing={showDraft} draftFailed={draftFailed} />}
      {/* Until a draft runs without a fault, the stage stands in for the table. */}
      {(!generation || showDraft || generation.done?.ok) && (
        <TableGuard resetKey={tableKey} onError={() => setUnrenderable(tableKey)}>
          {FLAT ? (
            <div className="flat-stage" style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
              <Table key={tableKey} {...tableProps} />
            </div>
          ) : (
            <Tabletop
              key={tableKey}
              {...tableProps}
              insets={insets}
              speech={preview ? undefined : speech}
              art={preview ? undefined : art}
              boardPaint={preview ? undefined : board?.paint}
            />
          )}
        </TableGuard>
      )}

      <header className="topbar">
        <div className="brand">
          <BrandMark />
          BoardDream
        </div>
        <label className="picker">
          <span>Now playing</span>
          <select value={games.indexOf(game)} onChange={(e) => selectGame(games[Number(e.target.value)])} disabled={generating}>
            {/* The hand-made reference games apart from those BoardDream generated from an idea. */}
            {[
              { label: "Original reference games", list: games.filter((g) => !generatedSource(g)) },
              { label: "Generated by BoardDream", list: games.filter((g) => generatedSource(g)) },
            ]
              .filter((group) => group.list.length > 0)
              .map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.list.map((g) => (
                    <option key={g.meta.id} value={games.indexOf(g)}>
                      {g.meta.name}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        </label>
        <button type="button" className="ghost" onClick={() => setLibrary(true)} title="Every game on one page: the demo games and the ones generated here">
          <LayoutGrid size={15} /> Games
        </button>
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
        <button type="button" className="ghost" onClick={() => setRulesOpen(true)} title="How to play this game">
          <BookOpen size={15} /> Rules
        </button>
        <button type="button" className="ghost" onClick={() => setPrinting(true)} title="Print the rules, board and cards to play on a real table">
          <Printer size={15} /> Print
        </button>
        <button type="button" className="ghost" onClick={() => setResults(true)} title="Every benchmark and measurement on one page">
          <BarChart3 size={15} /> Results
        </button>
        <button type="button" className="ghost" onClick={toggleSides} title="Fold or open both side panels (F)">
          {sides.left || sides.right ? <Maximize2 size={15} /> : <Minimize2 size={15} />} {sides.left || sides.right ? "Focus" : "Panels"}
        </button>
        <button type="button" className="ghost" onClick={() => setMatch(startMatch(game, numPlayers, params))}>
          <RotateCcw size={15} /> New game
        </button>
      </header>

      {!making &&
        (leftOpen ? (
          <button type="button" className="side-fold left" onClick={() => toggleSide("left")} title="Fold the panel away" aria-label="Fold the create panel away">
            <ChevronsLeft size={16} />
          </button>
        ) : (
          <button type="button" className="side-tab left" onClick={() => toggleSide("left")} title="Open the create panel">
            <Sparkles size={15} />
            <span>Dream up a game</span>
          </button>
        ))}
      {!making &&
        (rightOpen ? (
          <button type="button" className="side-fold right" onClick={() => toggleSide("right")} title="Fold the panels away" aria-label="Fold the tuning panels away">
            <ChevronsRight size={16} />
          </button>
        ) : (
          <button type="button" className="side-tab right" onClick={() => toggleSide("right")} title="Open the tuning, balance and log panels">
            <SlidersHorizontal size={15} />
            <span>Tune the rules</span>
          </button>
        ))}

      <aside className="sidebar left">
        {generation ? (
          <GenerationSteps
            generation={generation}
            onCancel={closeGeneration}
            onClose={closeGeneration}
            onDiscard={(made) => {
              removeGame(made);
              closeGeneration();
            }}
          />
        ) : (
          <CreatePanel available={canGenerate} busy={generating} onGenerate={generate} />
        )}
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
        {canGenerate && generatedSource(game) && (
          <RevisePanel
            game={game}
            onRevised={(revised) => {
              setGames((current) => [...current, revised]);
              selectGame(revised);
            }}
          />
        )}
        <ProfilePanel profile={profile.profile} pending={profile.pending} error={profile.error} />
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
      {rulesOpen && !results && !library && !generation && <RulesCard game={game} params={params} onClose={closeRules} />}
      {results && <ResultsPage onClose={() => setResults(false)} />}
      {library && (
        <GameLibrary
          games={games}
          current={game}
          busy={generating}
          onPlay={(g) => {
            selectGame(g);
            setLibrary(false);
          }}
          onDelete={removeGame}
          onClose={() => setLibrary(false)}
        />
      )}
      {printing && <PrintSheet game={game} params={params} art={art} onClose={() => setPrinting(false)} />}
    </div>
  );
}

// Which games' rules this browser has seen. Storage can be unavailable (private windows, previews):
// then the card simply opens again next time.
const rulesKey = (id: string) => `boarddream:rules-seen:${id}`;
function rulesSeen(id: string): boolean {
  try {
    return localStorage.getItem(rulesKey(id)) !== null;
  } catch {
    return false;
  }
}
function markRulesSeen(id: string) {
  try {
    localStorage.setItem(rulesKey(id), "1");
  } catch {
    // Not remembered; nothing else depends on it.
  }
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
