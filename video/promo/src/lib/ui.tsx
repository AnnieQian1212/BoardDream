// The film's shared pieces, all in BoardDream's own look: the paper stage, the app as a floating
// window, captions in the display serif with a gold marker, model chips as the app draws them, the
// ink cursor, and the hackathon tag.
import React from "react";
import { AbsoluteFill, Img, interpolate } from "remotion";
import { C, F, displaySoft, lift } from "./theme";
import { EASE, lerp, prog, useSec } from "./time";

/** The warm paper the app sits on, with a soft light from above and a faint hex grid. */
export const Stage: React.FC<{ children?: React.ReactNode; tone?: "paper" | "night" }> = ({ children, tone = "paper" }) => (
  <AbsoluteFill
    style={{
      background:
        tone === "paper"
          ? `radial-gradient(ellipse 80% 70% at 50% 38%, #f8efdb 0%, ${C.page} 62%, #dcc8a3 100%)`
          : `radial-gradient(ellipse 80% 70% at 50% 40%, #2b231b 0%, ${C.night} 70%, #0f0b08 100%)`,
    }}
  >
    <HexGrid tone={tone} />
    {children}
  </AbsoluteFill>
);

const HexGrid: React.FC<{ tone: "paper" | "night" }> = ({ tone }) => {
  const r = 46;
  const w = Math.sqrt(3) * r;
  const cells: React.ReactNode[] = [];
  for (let row = -1; row < 1080 / (1.5 * r) + 1; row++)
    for (let col = -1; col < 1920 / w + 1; col++) {
      const x = col * w + (row % 2 ? w / 2 : 0);
      const y = row * 1.5 * r;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
      }).join(" ");
      cells.push(<polygon key={`${row}-${col}`} points={pts} />);
    }
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: tone === "paper" ? 0.07 : 0.06 }}>
      <g fill="none" stroke={tone === "paper" ? C.ink : C.goldLight} strokeWidth={1.2}>
        {cells}
      </g>
    </svg>
  );
};

/** The app as a floating window: a still (or anything) in the app's lifted panel. */
export const Window: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
  src?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  depth?: number;
}> = ({ x, y, w, h, radius = 18, src, children, style, depth = 4 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      borderRadius: radius,
      overflow: "hidden",
      background: C.panel,
      ...lift(depth),
      ...style,
    }}
  >
    {src ? <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
    {children}
  </div>
);

/**
 * A caption line in the display serif, each word rising out of a blur (shotcraft blur-slide);
 * `mark` words get the gold marker stroke drawn under them once they land.
 */
export const Caption: React.FC<{
  text: string;
  at?: number; // s
  x?: number;
  y?: number;
  size?: number;
  align?: "left" | "center" | "right";
  width?: number;
  mark?: string[];
  color?: string;
  italic?: boolean;
  out?: number; // s, when it leaves
  stagger?: number;
}> = ({ text, at = 0, x = 960, y = 900, size = 68, align = "center", width = 1600, mark = [], color = C.ink, italic, out, stagger = 0.06 }) => {
  const t = useSec();
  const words = text.split(" ");
  const leave = out === undefined ? 0 : prog(t, out, out + 0.3, EASE.in);
  const left = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: y,
        width,
        textAlign: align,
        fontFamily: F.display,
        ...displaySoft,
        fontWeight: 600,
        fontStyle: italic ? "italic" : "normal",
        fontSize: size,
        lineHeight: 1.12,
        letterSpacing: "-0.01em",
        color,
        opacity: 1 - leave,
        transform: `translateY(${-24 * leave}px)`,
      }}
    >
      {words.map((wd, i) => {
        const k = prog(t, at + i * stagger, at + i * stagger + 0.5, EASE.out);
        const clean = wd.replace(/[.,!?:;]/g, "");
        const marked = mark.includes(clean);
        const m = prog(t, at + words.length * stagger + 0.15, at + words.length * stagger + 0.5, EASE.out);
        return (
          <span key={i} style={{ display: "inline-block", position: "relative", marginRight: "0.26em", opacity: k, transform: `translateY(${(1 - k) * 0.38}em)`, filter: `blur(${(1 - k) * 14}px)` }}>
            {marked ? (
              <span
                style={{
                  position: "absolute",
                  left: "-0.06em",
                  right: "-0.06em",
                  bottom: "0.06em",
                  height: "0.36em",
                  background: C.goldLight,
                  borderRadius: "0.12em",
                  transformOrigin: "left center",
                  transform: `scaleX(${m}) skewX(-8deg)`,
                  zIndex: -1,
                  opacity: 0.9,
                }}
              />
            ) : null}
            <span style={{ position: "relative" }}>{wd}</span>
          </span>
        );
      })}
    </div>
  );
};

/** A small caps label above a caption (e.g. "STEP 2 · MUSE SPARK"). */
export const Kicker: React.FC<{ text: string; at?: number; x: number; y: number; align?: "left" | "center"; color?: string }> = ({ text, at = 0, x, y, align = "center", color = C.accentStrong }) => {
  const t = useSec();
  const k = prog(t, at, at + 0.45);
  return (
    <div
      style={{
        position: "absolute",
        left: align === "center" ? x - 800 : x,
        top: y,
        width: align === "center" ? 1600 : undefined,
        textAlign: align,
        fontFamily: F.ui,
        fontWeight: 700,
        fontSize: 30,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color,
        opacity: k,
        transform: `translateY(${(1 - k) * 14}px)`,
      }}
    >
      {text}
    </div>
  );
};

/** A model chip as the app draws it on the making screen: a pill with a teal dot. */
export const ModelChip: React.FC<{ name: string; size?: number; tone?: "teal" | "gold" | "ink"; style?: React.CSSProperties }> = ({ name, size = 30, tone = "teal", style }) => {
  const bg = tone === "teal" ? "rgba(19,143,159,0.14)" : tone === "gold" ? "rgba(217,162,51,0.2)" : "rgba(45,32,22,0.08)";
  const fg = tone === "teal" ? C.accentStrong : tone === "gold" ? "#8a5f12" : C.ink;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.32,
        padding: `${size * 0.22}px ${size * 0.6}px`,
        borderRadius: 999,
        background: bg,
        color: fg,
        fontFamily: F.ui,
        fontWeight: 650,
        fontSize: size,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span style={{ width: size * 0.34, height: size * 0.34, borderRadius: 99, background: fg }} />
      {name}
    </span>
  );
};

/** The ink cursor the app's demo pages use, gliding through points; a ring where it clicks. */
export const Cursor: React.FC<{
  path: { t: number; x: number; y: number; click?: boolean }[];
  size?: number;
  hideBefore?: number;
  hideAfter?: number;
}> = ({ path, size = 56, hideBefore, hideAfter }) => {
  const t = useSec();
  if (hideBefore !== undefined && t < hideBefore) return null;
  if (hideAfter !== undefined && t > hideAfter) return null;
  let a = path[0];
  let b = path[path.length - 1];
  for (let i = 0; i < path.length - 1; i++)
    if (t >= path[i].t && t <= path[i + 1].t) {
      a = path[i];
      b = path[i + 1];
      break;
    }
  if (t < path[0].t) b = a;
  const k = a.t === b.t ? 1 : prog(t, a.t, b.t, EASE.inOut);
  const x = lerp(a.x, b.x, k);
  const y = lerp(a.y, b.y, k);
  const clicks = path.filter((p) => p.click);
  return (
    <>
      {clicks.map((p, i) => {
        const d = t - p.t;
        if (d < 0 || d > 0.6) return null;
        const r = interpolate(d, [0, 0.6], [8, 70]);
        return <div key={i} style={{ position: "absolute", left: p.x - r, top: p.y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", border: `4px solid ${C.gold}`, opacity: 1 - d / 0.6 }} />;
      })}
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute", left: x - size * 0.21, top: y - size * 0.125, filter: "drop-shadow(1px 3px 3px rgba(0,0,0,.35))", transform: `scale(${clicks.some((p) => t - p.t >= 0 && t - p.t < 0.12) ? 0.86 : 1})` }}>
        <path d="M5 3L19 12L12 13L9 20L5 3Z" fill={C.ink} stroke="#fffaf0" strokeWidth={1.7} strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** BoardDream's mark: the gold hex with the ink moon and star (apps/web/src/components/BrandMark.tsx). */
export const Mark: React.FC<{ size: number; style?: React.CSSProperties; id?: string }> = ({ size, style, id = "mk" }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" style={style}>
    <defs>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f6d98b" />
        <stop offset="100%" stopColor="#d99a2b" />
      </linearGradient>
      <mask id={`${id}-moon`}>
        <rect width="32" height="32" fill="white" />
        <circle cx="17.6" cy="13.4" r="6.1" fill="black" />
      </mask>
    </defs>
    <path d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25Z" fill={`url(#${id}-gold)`} />
    <circle cx="14.2" cy="16.4" r="7.4" fill="#2a2520" mask={`url(#${id}-moon)`} />
    <path d="M21.4 9.2l.85 2 2 .85-2 .85-.85 2-.85-2-2-.85 2-.85Z" fill="#2a2520" />
  </svg>
);

/** A small pill naming what a sped-up stretch really took ("real run · 6:12 → 4 s"). */
export const SpeedTag: React.FC<{ text: string; x: number; y: number; at?: number }> = ({ text, x, y, at = 0 }) => {
  const t = useSec();
  const k = prog(t, at, at + 0.35);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        padding: "8px 18px",
        borderRadius: 999,
        background: C.ink,
        color: C.panel,
        fontFamily: F.ui,
        fontWeight: 650,
        fontSize: 26,
        letterSpacing: "0.02em",
        opacity: k,
        transform: `scale(${0.9 + 0.1 * k})`,
        transformOrigin: "left center",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};
