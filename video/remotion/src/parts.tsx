import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, DISPLAY, HEIGHT, UI, WIDTH } from "./theme";

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

/** The storybook paper the reel's close-ups sit on, in one of the palette's colors. */
export const Backdrop: React.FC<{ color?: string }> = ({ color = C.paper2 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${C.paper} 0%, ${color} 75%)` }} />
);

/**
 * A recorded take shown as a close-up: a card on the backdrop holding part of the 1920 × 1080
 * footage, `zoom` times larger, centred on `focus` (footage pixels) and pushing in to `zoomTo`.
 */
export const Shot: React.FC<{
  src: string;
  from: number;
  rate?: number;
  zoom?: number;
  zoomTo?: number;
  focus: [number, number];
  card?: { width: number; height: number; x?: number; y?: number };
  durationInFrames: number;
}> = ({ src, from, rate = 1, zoom = 1.3, zoomTo, focus, card = { width: 1720, height: 968 }, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const z = interpolate(frame, [0, durationInFrames], [zoom, zoomTo ?? zoom], { easing: Easing.inOut(Easing.quad) });
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const tx = clamp(card.width / 2 - focus[0] * z, card.width - WIDTH * z, 0);
  const ty = clamp(card.height / 2 - focus[1] * z, card.height - HEIGHT * z, 0);
  const left = card.x ?? (WIDTH - card.width) / 2;
  const top = card.y ?? (HEIGHT - card.height) / 2;
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: card.width,
        height: card.height,
        overflow: "hidden",
        borderRadius: 28,
        border: `4px solid ${C.ink}`,
        boxShadow: `0 10px 0 ${C.ink}, 0 30px 60px rgba(45, 32, 22, 0.25)`,
        background: C.paper,
        scale: String(0.94 + 0.06 * enter),
      }}
    >
      <div style={{ position: "absolute", left: tx, top: ty, width: WIDTH, height: HEIGHT, transformOrigin: "0 0", scale: String(z) }}>
        <Video src={staticFile(src)} trimBefore={Math.round(from * fps)} playbackRate={rate} muted style={{ width: WIDTH, height: HEIGHT }} />
      </div>
    </div>
  );
};

/** Big serif words that rise in, for the reel's title and close. */
export const Headline: React.FC<{ text: string; size: number; delay?: number; color?: string; italic?: boolean }> = ({ text, size, delay = 0, color = C.ink, italic }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay * fps, fps, config: { damping: 16, stiffness: 120 } });
  return (
    <div style={{ fontFamily: DISPLAY, fontSize: size, fontWeight: 650, fontStyle: italic ? "italic" : "normal", color, lineHeight: 1.08, letterSpacing: "-0.01em", opacity: p, translate: `0px ${(1 - p) * 40}px`, textAlign: "center" }}>
      {text}
    </div>
  );
};

/** A line of the narration at the bottom, word by word as it is spoken. */
export interface Cue {
  start: number;
  end: number;
  text: string;
}
export const Captions: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cue = cues.find((c) => t >= c.start && t < c.end);
  if (!cue) return null;
  const words = cue.text.split(" ");
  const shown = Math.ceil(interpolate(t, [cue.start, cue.start + (cue.end - cue.start) * 0.75], [1, words.length], { extrapolateRight: "clamp" }));
  return (
    <div style={{ position: "absolute", left: 260, right: 420, bottom: 54, display: "flex", justifyContent: "center" }}>
      <div style={{ padding: "14px 28px 16px", borderRadius: 18, background: "rgba(45, 32, 22, 0.86)", color: C.paper, fontFamily: UI, fontSize: 38, fontWeight: 550, lineHeight: 1.3, textAlign: "center", maxWidth: 1240 }}>
        {words.map((w, i) => (
          <span key={i} style={{ opacity: i < shown ? 1 : 0.28 }}>
            {w}{" "}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Where the builder's camera goes, until it is recorded: a round frame in the corner. */
export const CameraBubble: React.FC<{ name: string }> = ({ name }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  return (
    <div
      style={{
        position: "absolute",
        right: 56,
        bottom: 48,
        width: 300,
        height: 300,
        borderRadius: "50%",
        background: C.paper2,
        border: `5px solid ${C.ink}`,
        boxShadow: `0 6px 0 ${C.ink}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        scale: String(p),
        fontFamily: UI,
        color: C.inkMuted,
        textAlign: "center",
      }}
    >
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={C.inkMuted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
      <div style={{ fontSize: 26, fontWeight: 600 }}>{name}</div>
      <div style={{ fontSize: 20 }}>camera goes here</div>
    </div>
  );
};

/** "Sped up 14×", and the time it really took, while a long wait plays fast. */
export const SpeedBadge: React.FC<{ factor: number; real: string }> = ({ factor, real }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 16, stiffness: 160 } });
  return (
    <div style={{ position: "absolute", left: 40, top: 92, padding: "10px 20px", borderRadius: 999, background: C.ink, color: C.paper, fontFamily: UI, fontSize: 28, fontWeight: 650, scale: String(p), display: "flex", gap: 14, alignItems: "center" }}>
      <span>▶▶ Sped up {factor}×</span>
      <span style={{ opacity: 0.7, fontWeight: 500 }}>{real} in real time</span>
    </div>
  );
};

/** The end: the mark, the name and where to play. */
export const Outro: React.FC<{ line?: string }> = ({ line }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  return (
    <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center", gap: 28 }}>
      <div style={{ scale: String(p), display: "flex", alignItems: "center", gap: 28 }}>
        <BrandMark size={150} />
        <div style={{ fontFamily: DISPLAY, fontSize: 120, fontWeight: 650, color: C.paper }}>BoardDream</div>
      </div>
      {line && <div style={{ fontFamily: UI, fontSize: 42, color: "#e9dcc4", opacity: p }}>{line}</div>}
      <div style={{ fontFamily: UI, fontSize: 36, color: C.gold, opacity: p, fontWeight: 600 }}>boarddream.pages.dev</div>
    </AbsoluteFill>
  );
};

/** Where a footage point shows on screen in a still Shot: for landing the guide on what a shot shows. */
export function onShot(point: [number, number], focus: [number, number], zoom: number, card = { width: 1720, height: 968 } as { width: number; height: number; x?: number; y?: number }): [number, number] {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const tx = clamp(card.width / 2 - focus[0] * zoom, card.width - WIDTH * zoom, 0);
  const ty = clamp(card.height / 2 - focus[1] * zoom, card.height - HEIGHT * zoom, 0);
  const left = card.x ?? (WIDTH - card.width) / 2;
  const top = card.y ?? (HEIGHT - card.height) / 2;
  return [Math.round(left + tx + point[0] * zoom), Math.round(top + ty + point[1] * zoom)];
}
