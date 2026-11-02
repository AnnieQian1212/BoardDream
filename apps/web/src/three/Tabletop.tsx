import { fitBounds, type CardView, type GameModule, type ResourceSpec } from "@boarddream/engine";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { NeutralToneMapping } from "three";
import { playerColor } from "../colors";
import { Hint, useHint } from "../components/Hint";
import { turnOf } from "../turn";
import { Result } from "../components/Table";
import { resourceById } from "../icons";
import { tidyPanels } from "../panels";
import { setCursor, setHover, useHover } from "./hover";
import { labelAnchors, Labels, markAnchors, type TargetMark } from "./Labels";
import { tableScale } from "./camera";
import { layoutTable, type Arrangement } from "./layout";
import { FONT_DISPLAY, FONT_UI } from "./paint";
import { initialTier, settings, stepDown } from "./quality";
import type { BoardPaint } from "./Board3D";
import { Scene, type Insets } from "./Scene";
import { cardFace } from "./textures";

interface Props {
  game: GameModule;
  state: unknown;
  numPlayers: number;
  human: number;
  /** Screen space covered by floating panels; the camera frames the table inside the rest. */
  insets: Insets;
  /** The latest line of table talk, shown as a bubble at the speaker's seat for a few seconds. */
  speech?: Speech;
  /** Painted card art by card title. */
  art?: Map<string, string>;
  /** Painted board art. */
  boardPaint?: BoardPaint;
  /** A game's first visit: a short guide (how to win, where to look) instead of the full rules. */
  guide?: Guide;
  onMove(move: unknown): void;
  onRestart(): void;
}

export interface Guide {
  /** How the game is won, in a sentence or two. */
  goal: string;
  onRules(): void;
  /** The guide was read, or the player has found their feet. */
  onDone(): void;
}

/** The guide steps aside by itself after this many of the player's moves. */
const GUIDED_MOVES = 3;

export interface Speech {
  id: number;
  seat: number;
  text: string;
}

const SPEECH_MS = 6000;
/** The fewest screen pixels per table unit the chips' room is laid out for; a smaller table shrinks its chips. */
const MIN_PX = 5;

/** The speech to show now: the latest one, until it has been up for a few seconds. */
function useSpeech(speech: Speech | undefined): Speech | undefined {
  const [hidden, setHidden] = useState<number>();
  useEffect(() => {
    if (!speech) return;
    const timer = setTimeout(() => setHidden(speech.id), SPEECH_MS);
    return () => clearTimeout(timer);
  }, [speech]);
  return speech && speech.id !== hidden ? speech : undefined;
}

// ?quality=lowest|low|medium|high pins the render quality; ?lowfx is the old spelling of low.
const params = new URLSearchParams(window.location.search);
const START = initialTier(params.get("quality") ?? (params.has("lowfx") ? "low" : null));

interface Menu {
  x: number;
  y: number;
  moves: unknown[];
}

/** The window's size, which the table fills. */
function useViewport() {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

/** Canvas text needs the web fonts loaded before the first card is painted. */
function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const faces = [`600 40px ${FONT_DISPLAY}`, `500 20px ${FONT_UI}`, `700 20px ${FONT_UI}`];
    Promise.all(faces.map((font) => document.fonts.load(font))).finally(() => setReady(true));
  }, []);
  return ready;
}

/** The seat whose move produced the current state. */
function useMover(state: unknown, active: number | undefined): number | undefined {
  const last = useRef({ state, active, mover: undefined as number | undefined });
  if (last.current.state !== state) last.current = { state, active, mover: last.current.active };
  else last.current.active = active;
  return last.current.mover;
}

/** The 3D table: the scene plus the HTML around it (move buttons, choice menu, card preview, result). */
export function Tabletop({ game, state, numPlayers, human, insets, speech, art, boardPaint, guide, onMove, onRestart }: Props) {
  const fonts = useFontsReady();
  const talking = useSpeech(speech);
  const [tier, setTier] = useState(START.tier);
  const quality = useMemo(() => settings(tier), [tier]);
  const [menu, setMenu] = useState<Menu | null>(null);
  useEffect(() => {
    setMenu(null);
    setHover(null);
    setCursor(false);
  }, [state]);

  const resources = useMemo(() => resourceById(game.meta.resources), [game]);
  const panels = useMemo(() => {
    const raw = tidyPanels(game.panels?.(state, human) ?? []);
    if (!art?.size) return raw;
    return raw.map((p) => (p.cards ? { ...p, cards: p.cards.map((c) => (c.art || c.faceDown ? c : { ...c, art: art.get(c.title) })) } : p));
  }, [game, state, human, art]);
  const geometry = useMemo(() => {
    const raw = game.geometry?.(state, human);
    return raw && fitBounds(raw);
  }, [game, state, human]);
  // Whose turn, what glows and what each click does: shared with the flat table.
  const turn = useMemo(() => turnOf(game, state, human, panels, geometry), [game, state, human, panels, geometry]);
  const { over, active, mine: myTurn, byTarget, targets, loose, label } = turn;
  const mover = useMover(state, active);
  const viewport = useViewport();
  const arranged = useRef<Arrangement>("sides");
  const { layout, chipScale } = useMemo(() => {
    const input = { panels, geometry, human, active, targets, resources };
    // The room mats leave for HTML chips depends on how large the table is drawn, which depends on
    // the layout: lay it out once, fit the camera to it, then lay it out at the scale that gives.
    // The arrangements that suit the screen are tried and the one that draws the table larger
    // kept; another must be clearly better to replace the one in use, so the table does not jump
    // between moves. A tall screen (a phone held upright) can stack the rivals under the board.
    const scaleOf = (arrangement: Arrangement) => tableScale(layoutTable({ ...input, arrangement }), viewport.width, viewport.height, insets);
    const tall = viewport.height > viewport.width * 1.15;
    const offered: Arrangement[] = [...(input.geometry ? (["sides", "right"] as const) : (["sides"] as const)), ...(tall ? (["stack"] as const) : [])];
    let arrangement = offered.includes(arranged.current) ? arranged.current : offered[0];
    let scale = scaleOf(arrangement);
    for (const other of offered) {
      if (other === arrangement) continue;
      const otherScale = scaleOf(other);
      if (otherScale > scale * 1.08) [arrangement, scale] = [other, otherScale];
    }
    arranged.current = arrangement;
    // Laid out for its chips the table may grow and be drawn smaller: check once more and size the
    // chips' room for whichever scale is smaller.
    // A window with no size yet (a hidden tab, a reload mid-resize) gives no scale: assume about 7.
    const clamp = (px: number) => (Number.isFinite(px) ? Math.min(24, Math.max(MIN_PX, px)) : 7);
    const first = layoutTable({ ...input, arrangement, pxPerUnit: clamp(scale) });
    const drawn = tableScale(first, viewport.width, viewport.height, insets);
    const layout = drawn < scale * 0.97 ? layoutTable({ ...input, arrangement, pxPerUnit: clamp(drawn * 0.97) }) : first;
    // Drawn smaller than the chips' room assumed (a phone), the chips shrink with the table, so
    // they keep to their mats instead of covering the board.
    const final = layout === first ? drawn : tableScale(layout, viewport.width, viewport.height, insets);
    return { layout, chipScale: Number.isFinite(final) ? Math.min(1, Math.max(0.4, final / MIN_PX)) : 1 };
  }, [panels, geometry, human, active, targets, resources, viewport, insets]);
  const hasSeats = panels.some((p) => p.zone === "players");
  const { hint, ask } = useHint(game, state, human);
  const hinted = hint && hint !== "thinking" ? game.moveTarget?.(state, hint.move) : undefined;
  // Board spots (corners, roads) that can be clicked pulse: they are small and alike, where a space
  // shows its own teal rim. The hinted target is flagged, whatever it is.
  const marks = useMemo(() => {
    const out: TargetMark[] = [];
    for (const id of targets) {
      const kind = turn.kindOf(id);
      if (kind) out.push({ id, kind, hint: id === hinted, ring: kind === "corner" || kind === "edge" });
    }
    return out;
  }, [turn, targets, hinted]);
  const todo = turn.instruction;
  const labelLayer = useRef<HTMLDivElement>(null);
  const labels = useMemo(() => ({ anchors: new Map([...labelAnchors(layout), ...markAnchors(layout, marks)]), layer: labelLayer }), [layout, marks]);
  // The guide counts the player's moves and steps aside after a few.
  const played = useRef({ state, moves: 0 });
  useEffect(() => {
    if (!guide || played.current.state === state) return;
    if (mover === human) played.current.moves++;
    played.current.state = state;
    if (played.current.moves >= GUIDED_MOVES) guide.onDone();
  }, [state, mover, human, guide]);

  const pick = (id: string, x: number, y: number) => {
    const options = byTarget.get(id);
    if (!options) return;
    if (options.length === 1) onMove(options[0]);
    else setMenu({ x, y, moves: options });
  };

  const free: CSSProperties = { left: insets.left, right: insets.right };

  return (
    <div className="stage">
      {fonts && (
        <Canvas
          frameloop="demand"
          shadows={quality.shadows ? "percentage" : false}
          dpr={quality.dpr}
          resize={{ debounce: 0 }}
          camera={{ fov: 30, near: 5, far: 1500, position: [0, 150, 110] }}
          gl={{ antialias: !quality.ambientOcclusion, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.toneMapping = NeutralToneMapping;
          }}
          onPointerMissed={() => setMenu(null)}
        >
          <Suspense fallback={null}>
            <Scene
              layout={layout}
              resources={resources}
              targets={targets}
              insets={insets}
              labels={labels}
              mover={mover}
              quality={quality}
              boardPaint={boardPaint}
              onSlow={START.locked ? undefined : () => setTier((t) => stepDown(t))}
              onPick={pick}
            />
          </Suspense>
        </Canvas>
      )}

      {fonts && (
        <Labels layout={layout} marks={marks} resources={resources} layer={labelLayer} targets={targets} speech={talking} chipScale={chipScale} onPick={pick} />
      )}

      {!hasSeats && (
        <div className="seat-strip" style={{ ...free, top: insets.top + 10 }}>
          {Array.from({ length: numPlayers }, (_, seat) => (
            <span key={seat} className={["seat-chip", seat === active && "active"].filter(Boolean).join(" ")} style={{ "--seat": playerColor(seat) } as CSSProperties}>
              <span className="seat-dot" />
              {seat === human ? "You" : `Player ${seat + 1}`}
              {talking?.seat === seat && (
                <span key={talking.id} className="speech below">
                  {talking.text}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      <Preview resources={resources} />

      {!over && (
        <div className="action-dock" style={free}>
          {guide && (
            <div className="guide" role="note">
              <div>
                <span className="guide-kicker">First game · how to win</span>
                <p>{guide.goal}</p>
                <p className="guide-tip">The bar below says what to do each turn; Hint marks a good move on the table.</p>
              </div>
              <div className="guide-actions">
                <button type="button" className="quiet" onClick={guide.onRules}>
                  Full rules
                </button>
                <button type="button" className="action" onClick={guide.onDone}>
                  Got it
                </button>
              </div>
            </div>
          )}
          <div className={["action-bar", myTurn && "mine"].filter(Boolean).join(" ")}>
            {myTurn ? (
              <span className="status">
                <span className="turn-tag">Your turn</span>
                {todo && <span className="todo">{todo}</span>}
              </span>
            ) : (
              <span className="status">{active !== undefined ? `Player ${active + 1} is thinking…` : ""}</span>
            )}
            {myTurn && <Hint hint={hint} onAsk={ask} onMove={onMove} />}
            {loose.map((move, i) => (
              <button key={i} type="button" className={loose.length <= 3 ? "action" : "action secondary"} onClick={() => onMove(move)}>
                {label(move)}
              </button>
            ))}
          </div>
        </div>
      )}

      {menu && (
        <div className="choice-menu" style={{ left: menu.x, top: menu.y }} onMouseLeave={() => setMenu(null)}>
          {menu.moves.map((move, i) => (
            <button key={i} type="button" onClick={() => onMove(move)}>
              {label(move)}
            </button>
          ))}
        </div>
      )}

      {over && <Result game={game} state={state} human={human} onRestart={onRestart} />}
    </div>
  );
}

/** The hovered card, magnified next to the pointer (the same painted face the 3D card wears). */
function Preview({ resources }: { resources: Map<string, ResourceSpec> }) {
  const hover = useHover();
  if (!hover) return null;
  if ("text" in hover) {
    return (
      <div className="tooltip" style={{ left: hover.x + 16, top: hover.y + 16 }}>
        {hover.text}
      </div>
    );
  }
  const width = 250;
  const height = width * (838 / 600);
  const left = hover.x > window.innerWidth / 2 ? hover.x - width - 28 : hover.x + 28;
  const top = Math.min(Math.max(hover.y - height / 2, 70), window.innerHeight - height - 20);
  return <CardPreview card={hover.card} resources={resources} style={{ left, top, width }} />;
}

function CardPreview({ card, resources, style }: { card: CardView; resources: Map<string, ResourceSpec>; style: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const source = cardFace(card, resources).image as HTMLCanvasElement;
    const ctx = ref.current!.getContext("2d")!;
    ctx.clearRect(0, 0, source.width, source.height);
    ctx.drawImage(source, 0, 0);
  }, [card, resources]);
  return <canvas ref={ref} className="card-preview" width={600} height={838} style={style} />;
}
