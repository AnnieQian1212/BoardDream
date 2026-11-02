import { createRng, resolveParams, type BalanceStats, type GameModule, type GameProfile, type Params, type Rng } from "@boarddream/engine";
import { referenceGames } from "@boarddream/library";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collectCards, startingGeometry, useArt } from "./art";
import { ArtPanel } from "./components/ArtPanel";
import { Designer, type DesignerTab } from "./components/Designer";
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
import { Home } from "./components/Home";
import { TableGuard } from "./components/TableGuard";
import { TopBar } from "./components/TopBar";
import { BalanceSection, TuneSection } from "./components/TuningPanel";
import { useCovers } from "./covers";
import { useEscape } from "./escape";
import { deleteGeneratedGame, generatedSource, savedGames } from "./generated";
import { useGeneration, type Dials } from "./generation";
import { goalOf } from "./instructions";
import { rulesFor } from "./rules";
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
/** Screen space the steps of a game being made, the designer's drawer, the top bar and the move bar cover. */
const PANEL_INSET = 326;
const DRAWER_INSET = 352;
const TOP_INSET = 66;
/** The first-game guide stands above the move bar; the table makes room for it. */
const GUIDE_INSET = 112;
const BOTTOM_INSET = 92;

function hasWebGL(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}
/** The game on the table until another is picked: one with a painted board, the table at its best. */
const FIRST_GAME = "lantern-isles";
const firstGame = referenceGames.find((g) => g.meta.id === FIRST_GAME) ?? referenceGames[0];
const initialGame = referenceGames.find((g) => g.meta.id === query.get("game")) ?? firstGame;
/** A link to a game, or bots playing one, opens at the table; anything else at home. */
const START_AT_TABLE = query.has("game") || WATCH;

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
  // Home asks what to play; the table plays it. The browser's Back button goes from one to the other.
  const [screen, setScreen] = useState<"home" | "table">(START_AT_TABLE ? "table" : "home");
  const atTable = screen === "table";
  useEffect(() => {
    const onPop = (e: PopStateEvent) => setScreen((e.state as { screen?: string } | null)?.screen === "table" ? "table" : "home");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const toTable = useCallback(() => {
    if (screenRef.current === "home") window.history.pushState({ screen: "table" }, "");
    setScreen("table");
  }, []);
  const toHome = useCallback(() => {
    if ((window.history.state as { screen?: string } | null)?.screen === "table") window.history.back();
    else setScreen("home");
  }, []);
  const [results, setResults] = useState(query.has("results"));
  const [library, setLibrary] = useState(query.has("games"));
  const [printing, setPrinting] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  // The designer's drawer: shut while playing, opened from the top bar (or F).
  const [designer, setDesigner] = useState<{ open: boolean; tab: DesignerTab }>({ open: false, tab: "rules" });
  const openDesigner = (tab?: DesignerTab) => setDesigner((d) => ({ open: tab ? true : !d.open, tab: tab ?? d.tab }));
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
  // Painted box covers; asked again when the games change (a new one may have been painted).
  const covers = useCovers(games.length);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable);
      if (!typing && atTable && e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) openDesigner();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [atTable]);

  // A game being made. Once it is ready it joins the picker and opens.
  const onReady = useCallback((g: GameModule) => {
    setGames((current) => [...current, g]);
    configure(g, defaultPlayers(g), resolveParams(g.params));
  }, []);
  const { generation, start: startGeneration, cancel: closeGeneration } = useGeneration(onReady);
  const generating = Boolean(generation && !generation.done && !generation.error);
  const generate = (prompt: string, dials: Dials, invented: boolean) => {
    setDesigner((d) => ({ ...d, open: false }));
    void startGeneration(prompt, dials, invented);
    toTable();
  };
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
    if (!preview || preview.stuck || !atTable) return;
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
  }, [preview, atTable]);

  // While a game is made, its steps take the left column and the stage the rest; the designer,
  // about the game that was on the table, stays shut until the new one is ready.
  const making = Boolean(generation);
  const drawerOpen = designer.open && !making;
  useEscape(() => setDesigner((d) => ({ ...d, open: false })), drawerOpen && atTable);

  // Bots take their turns one at a time, at the table only. Muse Spark may take a few seconds on a
  // social move; a decision for a state that has since changed (new game, undo) is dropped.
  useEffect(() => {
    if (game.isTerminal(match.state) || generating || !atTable) return;
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
  }, [game, match, muse, numPlayers, generating, atTable]);

  // Balance and the profile are measured only while the designer is open, so playing never pays
  // for them; a finished measurement is kept until the rules or sliders change.
  const measure = drawerOpen && atTable;
  const settingKey = `${game.meta.id}|${numPlayers}|${JSON.stringify(params)}`;
  const [stats, setStats] = useState<BalanceStats>();
  const statsFor = useRef<string>(undefined);
  useEffect(() => {
    if (!measure || statsFor.current === settingKey) return;
    setStats(undefined);
    const worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<BalanceStats>) => {
      setStats(event.data);
      if (event.data.games >= SIM_GAMES) statsFor.current = settingKey;
    };
    const request: SimRequest = { gameId: game.meta.id, source: generatedSource(game), numPlayers, params, games: SIM_GAMES };
    // Debounced, so dragging a slider starts one run when it settles.
    const timer = setTimeout(() => worker.postMessage(request), 200);
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
  }, [measure, settingKey]);

  // The profile is measured in its own worker: its planner games take longer than a balance run.
  const [profile, setProfile] = useState<{ profile?: GameProfile; pending: boolean; error?: string }>({ pending: true });
  const profileFor = useRef<string>(undefined);
  useEffect(() => {
    if (!measure || profileFor.current === settingKey) return;
    setProfile({ pending: true });
    const worker = new Worker(new URL("./profile.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ profile?: GameProfile; pending?: boolean; error?: string }>) => {
      setProfile((current) => ({ profile: event.data.profile ?? current.profile, pending: event.data.pending ?? false, error: event.data.error }));
      if (!event.data.pending) profileFor.current = settingKey;
    };
    const request: ProfileRequest = { gameId: game.meta.id, source: generatedSource(game), numPlayers, params };
    const timer = setTimeout(() => worker.postMessage(request), 400);
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
  }, [measure, settingKey]);

  function configure(nextGame: GameModule, nextPlayers: number, nextParams: Params) {
    setGame(nextGame);
    setNumPlayers(nextPlayers);
    setParams(nextParams);
    setMatch(startMatch(nextGame, nextPlayers, nextParams));
  }
  const selectGame = (g: GameModule) => configure(g, defaultPlayers(g), resolveParams(g.params));
  const playGame = (g: GameModule) => {
    if (g !== game) selectGame(g);
    setLibrary(false);
    toTable();
  };
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
  // A game's first visit to this browser starts with a short guide on the table, not a wall of rules.
  const [guided, setGuided] = useState(() => new Set<string>());
  const firstVisit = !WATCH && !preview && !guided.has(game.meta.id) && !rulesSeen(game.meta.id);
  const goal = useMemo(() => goalOf(rulesFor(game, params), game.meta.summary), [game, params]);
  const guiding = firstVisit && !rulesOpen && !generation;
  // On a narrow screen the drawer covers the table instead of pushing it aside.
  const insets = useMemo(
    () => ({
      left: making ? PANEL_INSET : 0,
      right: drawerOpen && window.innerWidth >= 760 ? DRAWER_INSET : 0,
      top: TOP_INSET,
      // On a phone the guide wraps onto more lines.
      bottom: BOTTOM_INSET + (guiding ? (window.innerWidth < 640 ? GUIDE_INSET * 1.4 : GUIDE_INSET) : 0),
    }),
    [making, drawerOpen, guiding],
  );
  const endGuide = () => {
    markRulesSeen(game.meta.id);
    setGuided((current) => new Set(current).add(game.meta.id));
  };
  const closeRules = () => {
    endGuide();
    setRulesOpen(false);
  };

  const overlays = (
    <>
      {results && <ResultsPage onClose={() => setResults(false)} />}
      {library && (
        <GameLibrary
          games={games}
          covers={covers}
          current={atTable ? game : undefined}
          busy={generating}
          onPlay={playGame}
          onDelete={removeGame}
          onClose={() => setLibrary(false)}
        />
      )}
    </>
  );

  if (!atTable) {
    return (
      <div className="app home-screen">
        <Home
          games={games}
          covers={covers}
          available={canGenerate}
          making={generating ? { title: generation?.plan?.title } : undefined}
          onGenerate={generate}
          onPlay={playGame}
          onWatch={toTable}
          onLibrary={() => setLibrary(true)}
          onResults={() => setResults(true)}
        />
        {overlays}
      </div>
    );
  }

  return (
    <div className={["app", making && "making", drawerOpen && "drawer-open"].filter(Boolean).join(" ")}>
      {generation && <GenerationStage generation={generation} previewing={showDraft} draftFailed={draftFailed} />}
      {/* Until a draft runs without a fault, the stage stands in for the table. */}
      {(!generation || showDraft || generation.done?.ok) && (
        <TableGuard resetKey={tableKey} onError={() => setUnrenderable(tableKey)} fallback={!preview}>
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
              guide={guiding ? { goal, onRules: () => setRulesOpen(true), onDone: endGuide } : undefined}
            />
          )}
        </TableGuard>
      )}

      <TopBar
        game={game}
        making={making}
        designerOpen={drawerOpen}
        opponentModel={opponentModel}
        muse={muse}
        onHome={toHome}
        onLibrary={() => setLibrary(true)}
        onRules={() => setRulesOpen(true)}
        onDesigner={() => openDesigner()}
        onRestart={() => setMatch(startMatch(game, numPlayers, params))}
        onMuse={setMuse}
        onPrint={() => setPrinting(true)}
        onLog={() => openDesigner("log")}
        onResults={() => setResults(true)}
      />

      {generation && (
        <aside className="sidebar left">
          <GenerationSteps
            generation={generation}
            onCancel={closeGeneration}
            onClose={closeGeneration}
            onDiscard={(made) => {
              removeGame(made);
              closeGeneration();
            }}
          />
        </aside>
      )}

      {!making && (
        <Designer
          open={drawerOpen}
          tab={designer.tab}
          onTab={(tab) => setDesigner({ open: true, tab })}
          onClose={() => setDesigner((d) => ({ ...d, open: false }))}
          panels={{
            rules: (
              <>
                <TuneSection game={game} numPlayers={numPlayers} params={params} onChange={(players, nextParams) => configure(game, players, nextParams)} />
                {canGenerate && generatedSource(game) && (
                  <RevisePanel
                    game={game}
                    onRevised={(revised) => {
                      setGames((current) => [...current, revised]);
                      selectGame(revised);
                    }}
                  />
                )}
              </>
            ),
            balance: (
              <>
                <BalanceSection stats={stats} simGames={SIM_GAMES} />
                <ProfilePanel profile={profile.profile} pending={profile.pending} error={profile.error} />
              </>
            ),
            art:
              cardCount > 0 || hasBoard ? (
                <ArtPanel
                  cards={cardCount}
                  painted={art.size}
                  painting={painting}
                  available={hasApiKey}
                  onPaint={() => void paint()}
                  board={hasBoard ? { report: board?.report, step: boardStep, onPaint: () => void paintBoard() } : undefined}
                />
              ) : undefined,
            log: <LogPanel entries={match.log} human={HUMAN} />,
          }}
        />
      )}
      {rulesOpen && !results && !library && !generation && <RulesCard game={game} params={params} onClose={closeRules} />}
      {overlays}
      {printing && <PrintSheet game={game} params={params} art={art} onClose={() => setPrinting(false)} />}
    </div>
  );
}

// Which games this browser has been shown how to play. Storage can be unavailable (private windows,
// previews): then the guide simply shows again next time.
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
