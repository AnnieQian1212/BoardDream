import { lightLeak } from "@remotion/effects/light-leak";
import { Video } from "@remotion/media";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { iris } from "@remotion/transitions/iris";
import { slide } from "@remotion/transitions/slide";
import React from "react";
import { AbsoluteFill, Easing, Img, Solid, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Handover } from "./timeline";
import { C, DISPLAY, FPS, HEIGHT, OUT, UI, WIDTH } from "./theme";

const ease = Easing.bezier(...OUT);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ─── Transitions ────────────────────────────────────────────────────────────────────────────────

/** The outgoing scene pushes in and goes soft; the incoming one settles out of a blur into focus. */
const BlurZoom: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({ children, presentationDirection, presentationProgress }) => {
  const p = ease(presentationProgress);
  const exiting = presentationDirection === "exiting";
  const scale = exiting ? 1 + 0.1 * p : 1.1 - 0.1 * p;
  const blur = exiting ? 18 * p : 18 * (1 - p);
  const opacity = exiting ? 1 : Math.min(1, presentationProgress * 1.6);
  return <AbsoluteFill style={{ scale: String(scale), filter: `blur(${blur.toFixed(2)}px)`, opacity }}>{children}</AbsoluteFill>;
};

/** The incoming scene is wiped on behind a soft, slanted edge. */
const SoftWipe: React.FC<TransitionPresentationComponentProps<{ angle: number }>> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  if (presentationDirection === "exiting") return <AbsoluteFill>{children}</AbsoluteFill>;
  const edge = -25 + 150 * ease(presentationProgress);
  const mask = `linear-gradient(${passedProps.angle}deg, black ${edge - 25}%, transparent ${edge}%)`;
  return <AbsoluteFill style={{ maskImage: mask, WebkitMaskImage: mask }}>{children}</AbsoluteFill>;
};

const blurZoom = (): TransitionPresentation<Record<string, never>> => ({ component: BlurZoom, props: {} });
const softWipe = (angle = 100): TransitionPresentation<{ angle: number }> => ({ component: SoftWipe, props: { angle } });

/** A light leak washing over a hard cut, in the film's gold (or another hue). */
export const LightLeak: React.FC<{ seed?: number; hueShift?: number }> = ({ seed = 0, hueShift = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <Solid
      width={WIDTH}
      height={HEIGHT}
      style={{ mixBlendMode: "screen", opacity: 0.62 }}
      effects={[lightLeak({ seed, hueShift, progress: interpolate(frame, [0, durationInFrames - 1], [0, 1], clamp) })]}
    />
  );
};

/**
 * The handovers, so a film can say which with one word, each in seconds whatever the frame rate.
 * (Their `transition` key is a scene's, not CSS's.)
 */
/* eslint-disable @remotion/non-pure-animation */
const frames = (seconds: number) => Math.max(2, Math.round(seconds * FPS));
export const T = {
  blur: (seconds = 0.73): Handover => ({ transition: blurZoom(), frames: frames(seconds) }),
  wipe: (seconds = 0.8, angle = 100): Handover => ({ transition: softWipe(angle), frames: frames(seconds) }),
  push: (seconds = 0.67, direction: "from-right" | "from-left" | "from-bottom" | "from-top" = "from-right"): Handover => ({ transition: slide({ direction }), frames: frames(seconds) }),
  iris: (seconds = 0.87): Handover => ({ transition: iris({ width: WIDTH, height: HEIGHT }), frames: frames(seconds) }),
  fade: (seconds = 0.67): Handover => ({ transition: fade(), frames: frames(seconds) }),
  leak: (seconds = 1.13, seed = 1, hueShift = 0): Handover => ({ overlay: <LightLeak seed={seed} hueShift={hueShift} />, frames: frames(seconds) }),
};
/* eslint-enable @remotion/non-pure-animation */

// ─── Footage ────────────────────────────────────────────────────────────────────────────────────

/** Where the camera is: how far in, and the page point (1920 × 1080 page pixels) at the centre. */
export type Move = {
  /** When the move starts, in seconds of the scene's own time. */
  at: number;
  zoom: number;
  focus: [number, number];
  /** How long the move takes; about a second reads as a deliberate push or a whip. */
  over?: number;
};

/** Fast through the middle, settling hard at both ends: a push-in or a whip pan, not a drift. */
const snap = Easing.bezier(0.76, 0, 0.24, 1);
const drift = Easing.inOut(Easing.cubic);

/** The camera at `t`: each move starts from wherever the last one left it. */
const cameraAt = (moves: Move[], t: number) => {
  let zoom = moves[0].zoom;
  let [x, y] = moves[0].focus;
  for (const m of moves.slice(1)) {
    const p = snap(Math.min(1, Math.max(0, (t - m.at) / (m.over ?? 0.9))));
    if (p <= 0) break;
    zoom += (m.zoom - zoom) * p;
    x += (m.focus[0] - x) * p;
    y += (m.focus[1] - y) * p;
  }
  return { zoom, x, y };
};

/**
 * A take filling the frame. The camera either moves in deliberate steps (`camera`: a push in, a
 * whip across, each about a second, with a slow breath of zoom between so it never sits dead) or
 * drifts once across the scene (`zoom` and `focus`, from the first to the second). It never shows
 * past the take's edge, and moves the picture by transform, never by layout, so nothing snaps to
 * whole pixels. `from` is where the scene's own time starts in the take; `lead` the scene's head
 * start (Timeline), played from earlier in the take.
 */
export const Footage: React.FC<{
  src: string;
  from: number;
  lead: number;
  rate?: number;
  camera?: Move[];
  zoom?: [number, number];
  focus?: [[number, number], [number, number]];
  /** The frame it fills, when not the whole picture (one side of a split screen). */
  box?: { width: number; height: number };
}> = ({ src, from, lead, rate = 1, camera, zoom = [1, 1], focus = [
  [960, 540],
  [960, 540],
], box = { width: WIDTH, height: HEIGHT } }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps - lead;
  let view: { zoom: number; x: number; y: number };
  if (camera) {
    view = cameraAt(camera, t);
    view.zoom *= 1 + 0.012 * t;
  } else {
    const p = drift(Math.min(1, frame / Math.max(1, durationInFrames - 1)));
    view = { zoom: zoom[0] + (zoom[1] - zoom[0]) * p, x: focus[0][0] + (focus[1][0] - focus[0][0]) * p, y: focus[0][1] + (focus[1][1] - focus[0][1]) * p };
  }
  const z = Math.max(1, view.zoom);
  const within = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const x = within(box.width / 2 - view.x * z, box.width - WIDTH * z, 0);
  const y = within(box.height / 2 - view.y * z, box.height - HEIGHT * z, 0);
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT, transformOrigin: "0 0", transform: `translate(${x}px, ${y}px) scale(${z})`, willChange: "transform" }}>
        <Video src={staticFile(src)} trimBefore={Math.max(0, Math.round((from - lead * rate) * fps))} playbackRate={rate} muted style={{ width: "100%", height: "100%" }} />
      </div>
    </AbsoluteFill>
  );
};

// ─── Type ───────────────────────────────────────────────────────────────────────────────────────

/** Words that rise into place one after another, each from behind its own line. */
export const Rise: React.FC<{ text: string; size: number; delay?: number; color?: string; italic?: boolean; weight?: number; stagger?: number; style?: React.CSSProperties }> = ({
  text,
  size,
  delay = 0,
  color = C.cream,
  italic,
  weight = 500,
  stagger = 0.07,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ fontFamily: DISPLAY, fontSize: size, fontWeight: weight, fontStyle: italic ? "italic" : "normal", color, lineHeight: 1.12, letterSpacing: "-0.015em", ...style }}>
      {text.split(" ").map((word, i) => {
        const p = ease(Math.min(1, Math.max(0, (frame / fps - delay - i * stagger) / 0.9)));
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.08em", marginRight: "0.24em" }}>
            <span style={{ display: "inline-block", translate: `0px ${(1 - p) * 110}%`, opacity: p }}>{word}</span>
          </span>
        );
      })}
    </div>
  );
};

/** A small spaced capital line above a headline. */
export const Eyebrow: React.FC<{ text: string; delay?: number; color?: string }> = ({ text, delay = 0, color = C.gold }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = ease(Math.min(1, Math.max(0, (frame / fps - delay) / 0.8)));
  return (
    <div style={{ fontFamily: UI, fontSize: 24, fontWeight: 600, letterSpacing: "0.32em", textTransform: "uppercase", color, opacity: p, translate: `${(1 - p) * -24}px 0px` }}>{text}</div>
  );
};

/**
 * What is at work, in the lower left (or the upper left, over a shot whose subject is at the bottom):
 * a gold label (a model's name) and a line, in a dark glass strip that slides in, stays, and goes.
 * Times in seconds of the scene's own time.
 */
export const LowerThird: React.FC<{ label: string; text: string; lead: number; at?: number; until: number; high?: boolean }> = ({ label, text, lead, at = 0.4, until, high }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - lead;
  const inP = ease(Math.min(1, Math.max(0, (t - at) / 0.7)));
  const outP = ease(Math.min(1, Math.max(0, (t - until + 0.5) / 0.5)));
  const shown = inP * (1 - outP);
  if (shown <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        ...(high ? { top: 84 } : { bottom: 84 }),
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "20px 34px 22px 28px",
        borderRadius: 18,
        background: "linear-gradient(90deg, rgba(18,13,10,0.88), rgba(18,13,10,0.72))",
        backdropFilter: "blur(14px)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
        clipPath: `inset(0 ${(1 - inP) * 100}% 0 0 round 18px)`,
        opacity: 1 - outP,
        translate: `${(1 - inP) * -30}px 0px`,
      }}
    >
      <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: C.gold }} />
      <div>
        <div style={{ fontFamily: UI, fontSize: 20, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: C.gold }}>{label}</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 38, fontWeight: 500, color: C.cream, marginTop: 4 }}>{text}</div>
      </div>
    </div>
  );
};

/** A small badge in the top right while a long wait plays fast. */
export const SpeedBadge: React.FC<{ factor: number; real: string }> = ({ factor, real }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = ease(Math.min(1, frame / fps / 0.6));
  return (
    <div
      style={{
        position: "absolute",
        right: 56,
        top: 92,
        display: "flex",
        gap: 14,
        alignItems: "center",
        padding: "12px 22px",
        borderRadius: 999,
        background: "rgba(18,13,10,0.82)",
        backdropFilter: "blur(10px)",
        color: C.cream,
        fontFamily: UI,
        fontSize: 24,
        fontWeight: 600,
        opacity: p,
        translate: `0px ${(1 - p) * -12}px`,
      }}
    >
      <span style={{ color: C.gold }}>{factor}× speed</span>
      <span style={{ color: C.creamMuted, fontWeight: 500 }}>{real} in real time</span>
    </div>
  );
};

// ─── Grounds ────────────────────────────────────────────────────────────────────────────────────

/** The cards' ground: warm near-black, a slow drifting glow, a vignette and fine grain. */
export const Night: React.FC<{ glow?: string; children?: React.ReactNode }> = ({ glow = C.gold, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = Math.sin(frame / fps / 3) * 6;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${42 + drift}% ${38 - drift / 2}%, ${glow}2e 0%, transparent 46%), radial-gradient(circle at ${70 - drift}% ${74 + drift / 2}%, ${C.teal}1a 0%, transparent 42%)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 75% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
      <Grain />
      {children}
    </AbsoluteFill>
  );
};

/** Film grain: fine noise that changes fifteen times a second. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.07 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seed = Math.floor((frame / fps) * 15) % 17;
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width={WIDTH} height={HEIGHT}>
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** BoardDream's mark (apps/web/src/components/BrandMark.tsx): a gold hex holding a moon and a star. */
export const BrandMark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <defs>
      <linearGradient id="mark-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f6d98b" />
        <stop offset="100%" stopColor="#d99a2b" />
      </linearGradient>
      <mask id="mark-moon">
        <rect width="32" height="32" fill="white" />
        <circle cx="17.6" cy="13.4" r="6.1" fill="black" />
      </mask>
    </defs>
    <path d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25Z" fill="url(#mark-gold)" />
    <circle cx="14.2" cy="16.4" r="7.4" fill="#2a2520" mask="url(#mark-moon)" />
    <path d="M21.4 9.2l.85 2 2 .85-2 .85-.85 2-.85-2-2-.85 2-.85Z" fill="#2a2520" />
  </svg>
);

/** The mark and the name, with a sheen passing over the name. */
export const Wordmark: React.FC<{ size: number; delay?: number }> = ({ size, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - delay;
  const mark = ease(Math.min(1, Math.max(0, t / 0.9)));
  const word = ease(Math.min(1, Math.max(0, (t - 0.25) / 1)));
  const sheen = interpolate(t, [0.8, 2.2], [-30, 130], clamp);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
      <div style={{ scale: String(0.6 + 0.4 * mark), rotate: `${(1 - mark) * -30}deg`, opacity: mark }}>
        <BrandMark size={size * 1.25} />
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: size,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          backgroundImage: `linear-gradient(100deg, ${C.cream} ${sheen - 12}%, #fff6dc ${sheen}%, ${C.cream} ${sheen + 12}%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          clipPath: `inset(0 ${(1 - word) * 100}% 0 0)`,
        }}
      >
        BoardDream
      </div>
    </div>
  );
};

/** A wall of the games' covers, tilted back and drifting, darkened toward the edges. */
export const CoverWall: React.FC<{ covers: string[]; dim?: number }> = ({ covers, dim = 0.5 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / durationInFrames;
  const cols = 5;
  const rows = 4;
  const w = 520;
  const h = 347;
  const gap = 26;
  return (
    <AbsoluteFill style={{ background: C.night, perspective: 1800, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: cols * (w + gap),
          height: rows * (h + gap),
          transform: `translate(-50%, -50%) rotateX(22deg) rotateZ(-8deg) scale(${1.05 + 0.12 * p}) translateX(${-60 + 120 * p}px)`,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${w}px)`,
          gap,
        }}
      >
        {Array.from({ length: cols * rows }, (_, i) => (
          <Img key={i} src={staticFile(`covers/${covers[(i * 7) % covers.length]}`)} style={{ width: w, height: h, objectFit: "cover", borderRadius: 14, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }} />
        ))}
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 65% at 50% 50%, rgba(18,13,10,${dim * 0.6}) 0%, rgba(18,13,10,${Math.min(1, dim + 0.4)}) 100%)` }} />
    </AbsoluteFill>
  );
};

/** Subtitles for the narration: plain cream type over a soft shade along the bottom, no box. */
export interface Cue {
  start: number;
  end: number;
  text: string;
}
/** `high`: stretches (seconds) where the subtitles sit at the top, over a shot whose subject is at the bottom. */
export const Subtitles: React.FC<{ cues: Cue[]; hide?: [number, number][]; high?: [number, number][] }> = ({ cues, hide = [], high = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (hide.some(([a, b]) => t >= a && t < b)) return null;
  const top = high.some(([a, b]) => t >= a && t < b);
  const cue = cues.find((c) => t >= c.start && t < c.end);
  if (!cue) return null;
  const p = Math.min(1, (t - cue.start) / 0.25, (cue.end - t) / 0.2);
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, height: 190, ...(top ? { top: 0 } : { bottom: 0 }), background: `linear-gradient(${top ? "rgba(10,7,5,0.55), transparent" : "transparent, rgba(10,7,5,0.55)"})` }} />
      <div
        style={{
          position: "absolute",
          left: 240,
          right: 240,
          ...(top ? { top: 52 } : { bottom: 52 }),
          textAlign: "center",
          fontFamily: UI,
          fontSize: 36,
          fontWeight: 550,
          lineHeight: 1.32,
          color: "#fffaf0",
          textShadow: "0 2px 12px rgba(0,0,0,0.65)",
          opacity: p,
        }}
      >
        {cue.text}
      </div>
    </>
  );
};

export { ease, clamp };
