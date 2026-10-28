import type { CardView, GameModule, ResourceSpec } from "@boarddream/engine";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { NeutralToneMapping } from "three";
import { playerColor } from "../colors";
import { Result } from "../components/Table";
import { resourceById } from "../icons";
import { setCursor, setHover, useHover } from "./hover";
import { labelAnchors, Labels } from "./Labels";
import { layoutTable } from "./layout";
import { FONT_DISPLAY, FONT_UI } from "./paint";
import { initialTier, settings, stepDown } from "./quality";
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
  onMove(move: unknown): void;
  onRestart(): void;
}

export interface Speech {
  id: number;
  seat: number;
  text: string;
}

const SPEECH_MS = 6000;

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
export function Tabletop({ game, state, numPlayers, human, insets, speech, onMove, onRestart }: Props) {
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

  const over = game.isTerminal(state);
  const active = over ? undefined : game.activePlayers(state)[0];
  const myTurn = active === human;
  const mover = useMover(state, active);
  const resources = useMemo(() => resourceById(game.meta.resources), [game]);
  const label = (move: unknown) => game.describeMove?.(state, move, human) ?? JSON.stringify(move);

  const { byTarget, loose } = useMemo(() => {
    const byTarget = new Map<string, unknown[]>();
    const loose: unknown[] = [];
    for (const move of myTurn ? game.legalMoves(state, human) : []) {
      const target = game.moveTarget?.(state, move);
      if (target === undefined) loose.push(move);
      else byTarget.set(target, [...(byTarget.get(target) ?? []), move]);
    }
    return { byTarget, loose };
  }, [game, state, human, myTurn]);
  const targets = useMemo(() => new Set(byTarget.keys()), [byTarget]);

  const panels = useMemo(() => game.panels?.(state, human) ?? [], [game, state, human]);
  const layout = useMemo(
    () => layoutTable({ panels, geometry: game.geometry?.(state, human), human, active, targets, resources }),
    [game, state, panels, human, active, targets, resources],
  );
  const hasSeats = panels.some((p) => p.zone === "players");
  const labelLayer = useRef<HTMLDivElement>(null);
  const labels = useMemo(() => ({ anchors: labelAnchors(layout), layer: labelLayer }), [layout]);

  const pick = (id: string, x: number, y: number) => {
    const options = byTarget.get(id);
    if (!options) return;
    if (options.length === 1) onMove(options[0]);
    else setMenu({ x, y, moves: options });
  };

  let status = myTurn ? "Your turn" : active !== undefined ? `Player ${active + 1} is thinking…` : "";
  if (myTurn && targets.size > 0) status += " · pick something that glows";
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
              onSlow={START.locked ? undefined : () => setTier((t) => stepDown(t))}
              onPick={pick}
            />
          </Suspense>
        </Canvas>
      )}

      {fonts && <Labels layout={layout} resources={resources} layer={labelLayer} targets={targets} speech={talking} onPick={pick} />}

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
          <div className="action-bar">
            <span className="status">{status}</span>
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
