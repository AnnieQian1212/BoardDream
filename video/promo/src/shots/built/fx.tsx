// origin: video-shotcraft demos/_fixtures/Polish.tsx (SpeedBlur, bezier presets, ramp/mix).
// Directional motion blur from a screen speed (px per 1/30 s): a horizontal Gaussian along the motion,
// only while moving; zero cost at rest.
import React from "react";

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const ax = 1 - 3 * x2 + 3 * x1,
    bx = 3 * x2 - 6 * x1,
    cx = 3 * x1;
  const ay = 1 - 3 * y2 + 3 * y1,
    by = 3 * y2 - 6 * y1,
    cy = 3 * y1;
  const sx = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sy = (u: number) => ((ay * u + by) * u + cy) * u;
  const dx = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  const solve = (x: number) => {
    let u = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(u) - x;
      if (Math.abs(err) < 1e-7) return u;
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= err / d;
    }
    let lo = 0,
      hi = 1;
    u = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(u);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
    return u;
  };
  return (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : sy(solve(t)));
};

export const EZ = {
  snappy: bezier(0.16, 1, 0.3, 1),
  out: bezier(0.22, 1, 0.36, 1),
  smooth: bezier(0.65, 0, 0.35, 1),
  swift: bezier(0.4, 0, 0.2, 1),
  overshoot: bezier(0.34, 1.45, 0.64, 1),
};

/** Normalized progress of t over [start, start + dur] seconds, eased, clamped. */
export const ramp = (t: number, start: number, dur: number, ease: (x: number) => number = EZ.snappy) => ease(clamp01((t - start) / Math.max(1e-6, dur)));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const alpha = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export const SpeedBlur: React.FC<{ vx: number; vy?: number; amount?: number; max?: number; children: React.ReactNode }> = ({ vx, vy = 0, amount = 0.45, max = 36, children }) => {
  const rid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const speed = Math.hypot(vx, vy);
  const sd = Math.min(max, speed * amount);
  const fill: React.CSSProperties = { position: "absolute", inset: 0 };
  if (sd < 0.35) return <div style={fill}>{children}</div>;
  const deg = (Math.atan2(vy, vx) * 180) / Math.PI;
  const id = `speedblur-${rid}`;
  return (
    <div style={fill}>
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`${sd.toFixed(2)} 0`} edgeMode="none" />
        </filter>
      </svg>
      <div style={{ ...fill, transform: `rotate(${deg}deg)`, filter: `url(#${id})` }}>
        <div style={{ ...fill, transform: `rotate(${-deg}deg)` }}>{children}</div>
      </div>
    </div>
  );
};
