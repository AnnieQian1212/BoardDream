// Pieces shared by the table and house-rule shots: the app window's settled geometry (the same in
// both, so the cut between them keeps the window in place), the honesty pills that say whether the
// footage runs at real speed or how much it was sped up, and the paper lower-third that carries the
// captions over the footage.
import React from "react";
import { C, F, lift } from "../../lib/theme";
import { EASE, prog, useSec } from "../../lib/time";

/** The app window, settled: 0.84 of the page (1613 × 907, 70 % of the frame), under the hackathon tag. */
export const WIN_S = 0.84;
export const WIN_TOP = 92;
export const WIN_LEFT = 960 - 960 * WIN_S;
export const WIN_W = 1920 * WIN_S;
export const WIN_H = 1080 * WIN_S;
export const WIN_R = 18 * WIN_S;
/** The push the table shot ends on, which the house-rule shot starts from. */
export const END_PUSH = 1.018;

/** A page point (CSS px) on screen inside the settled window, with a push about the window's centre. */
export const inWindow = (x: number, y: number, push = 1) => {
  const cx = 960;
  const cy = WIN_TOP + WIN_H / 2;
  return { x: cx + (WIN_LEFT + x * WIN_S - cx) * push, y: cy + (WIN_TOP + y * WIN_S - cy) * push };
};

/** "● Live · real speed" or "Real run · 84 s → 1 s": what the footage's clock is, said plainly. */
export const ClockPill: React.FC<{ text: string; live?: boolean; x: number; y: number; at: number; out?: number }> = ({ text, live, x, y, at, out }) => {
  const t = useSec();
  const k = prog(t, at, at + 0.3, EASE.land);
  const o = prog(t, at, at + 0.15) * (out === undefined ? 1 : 1 - prog(t, out, out + 0.12));
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 20px 8px 16px",
        borderRadius: 999,
        background: C.ink,
        color: C.panel,
        fontFamily: F.ui,
        fontWeight: 650,
        fontSize: 30,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        opacity: o,
        transform: `scale(${0.85 + 0.15 * k})`,
        transformOrigin: "left center",
        boxShadow: "0 6px 16px rgba(30,20,10,0.25)",
      }}
    >
      {live ? <span style={{ width: 14, height: 14, borderRadius: 99, background: "#e0533d", boxShadow: "0 0 0 4px rgba(224,83,61,0.25)" }} /> : null}
      {text}
    </div>
  );
};

/** A paper lower-third laid over the footage (the app's lifted panel), sliding up on its entrance. */
export const LowerThird: React.FC<{ x: number; y: number; w: number; h: number; at: number; children: React.ReactNode }> = ({ x, y, w, h, at, children }) => {
  const t = useSec();
  const k = prog(t, at, at + 0.42, EASE.land);
  const o = prog(t, at, at + 0.18);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 18,
        background: "rgba(251, 243, 225, 0.97)",
        ...lift(3),
        opacity: o,
        transform: `translateY(${(1 - k) * 40}px)`,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
};
