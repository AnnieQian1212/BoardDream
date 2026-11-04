// Part (b), shotcraft `terminal-3d` (demos/camera/terminal-3d/Terminal3D.tsx): three windows of
// BoardDream's own code stand in space; the camera visits each one, pulling back mid-flight so all
// three are seen at once. Kept from the card: the pose table and the camera as its inverse, one
// transform chain shared by the windows, the floor grid and the lights (project()), the sine
// pull-back bump, 8-10 degree side views at each stop, depth blur by distance from the stop
// (narrower when pulled back), outlined step numbers behind the windows, motion blur only in flight,
// and windows laid out at their on-screen size so code rasterizes 1:1.
// Changed for this film: the card's lime terminal becomes BoardDream's ink and gold, the command
// typing becomes code printing line by line on arrival (no CLI here), and flight 1 ends in a
// crash-zoom-punch (impact kind) on the music's drop two.
import React from "react";
import { AbsoluteFill } from "remotion";
import { C, F } from "../../lib/theme";
import { Caption, Kicker } from "../../lib/ui";
import { WINDOWS } from "./code";
import { BEAT } from "../../lib/time";
import { EZ, SpeedBlur, alpha, bezier, mix, ramp } from "./fx";

const W = 1520;
const H = 620;
const PERSP = 1800;
const FLOOR_Y = 470;
const GOLD = "#f2cf7c";
const CREAM = "#f1e6d4";

type Pose = { x: number; y: number; z: number; ry: number };
const POSES: Pose[] = [
  { x: -1650, y: -20, z: -220, ry: 22 },
  { x: 0, y: 30, z: 260, ry: -14 },
  { x: 1680, y: -30, z: -160, ry: 24 },
];
const VIEW = [9, -8, 10];
const TILT = -4;
// Part-local beats: the part starts on beat 20 of the shot; drop two is beat 8 here (3.69 s).
// Flight 1 rises through the music's build (pulled back, all windows glimpsed), winds back 3%, then
// rushes in 0.2 s (6f of 30, ease-in) onto window 2 exactly on the drop and stops dead: a hard shake
// (14 px, e^(-t/1.8f), crash-zoom-punch's impact kind) and a warm exposure flash, the shot's one
// whole-frame hit. Flight 2 is the card's soft flight, landing window 3 on beat 16 (7.38 s).
// Each window is then held still: 1.9 s, 2.65 s, 3.7 s.
const DROP = 8 * BEAT;
const FLY = [
  [2.5, DROP],
  [6.62, 16 * BEAT],
] as const;
const ARRIVE = [0.6, FLY[0][1], FLY[1][1]];
const PULL_PEAK = 1300;
const RUSH = 0.2;
const EXIT = bezier(0.7, 0, 0.84, 0);

const camAt = (t: number) => {
  // the opening push, unhurried
  let pull = 420 * (1 - ramp(t, 0, 0.6, EZ.out));
  // flight 1: across to window 2 while pulling back (2.5-3.3, in the build), a 3% wind-back, the rush on the drop
  const glide = ramp(t, FLY[0][0], 0.8, EZ.smooth);
  let s = glide;
  const wind = 1 + 0.03 * ramp(t, FLY[0][0] + 0.8, DROP - RUSH - FLY[0][0] - 0.8, EZ.smooth);
  pull += PULL_PEAK * glide * wind * (1 - ramp(t, DROP - RUSH, RUSH, EXIT));
  // flight 2: the card's flight, a sine pull-back bump, a soft landing
  const [a, b] = FLY[1];
  s += ramp(t, a, b - a, EZ.swift);
  const raw = Math.min(1, Math.max(0, (t - a) / (b - a)));
  pull += Math.sin(Math.PI * Math.pow(raw, 0.85)) * 800;
  pull -= 30 * ramp(t, 8.2, 2.8, EZ.smooth);
  const i0 = Math.min(1, Math.floor(s));
  const k = s - i0;
  const pa = POSES[i0],
    pb = POSES[i0 + 1];
  const pose: Pose = { x: mix(pa.x, pb.x, k), y: mix(pa.y, pb.y, k), z: mix(pa.z, pb.z, k), ry: mix(pa.ry, pb.ry, k) };
  return { s, pull, pose, yaw: mix(VIEW[i0], VIEW[i0 + 1], k) - pose.ry };
};

/** crash-zoom-punch's impact shake, screen space, deterministic (t in frames of 30 after the hit). */
const shakeAt = (t: number) => {
  const f = (t - DROP) * 30;
  if (f < 0) return { sx: 0, sy: 0, rot: 0 };
  const env = 14 * Math.exp(-f / 1.8);
  if (env < 0.15) return { sx: 0, sy: 0, rot: 0 };
  return { sx: env * 0.55 * Math.sin(f * 2.4 + 0.6), sy: env * Math.cos(f * 2.9), rot: env * 0.025 * Math.sin(f * 3.7 + 1.9) };
};
type Cam = ReturnType<typeof camAt>;

/** The same transform as the world's CSS chain: translateZ(-pull) rotateX(TILT) rotateY(yaw) translate(-pose). */
const project = (cam: Cam, p: [number, number, number]) => {
  const x0 = p[0] - cam.pose.x,
    y0 = p[1] - cam.pose.y,
    z0 = p[2] - cam.pose.z;
  const ty = (cam.yaw * Math.PI) / 180,
    tx = (TILT * Math.PI) / 180;
  const x1 = x0 * Math.cos(ty) + z0 * Math.sin(ty);
  const z1 = -x0 * Math.sin(ty) + z0 * Math.cos(ty);
  const y2 = y0 * Math.cos(tx) - z1 * Math.sin(tx);
  const z2 = y0 * Math.sin(tx) + z1 * Math.cos(tx) - cam.pull;
  return { x: x1, y: y2, z: z2 };
};
const toScreen = (q: { x: number; y: number; z: number }) => {
  const k = PERSP / (PERSP - q.z);
  return { x: 960 + q.x * k, y: 540 + q.y * k, k };
};

const Floor: React.FC<{ cam: Cam }> = ({ cam }) => {
  const segs: React.ReactNode[] = [];
  const CELL = 240;
  const near = PERSP - 120;
  const line = (a: [number, number, number], b: [number, number, number], key: string) => {
    const N = 8;
    for (let j = 0; j < N; j++) {
      const pa = project(cam, [mix(a[0], b[0], j / N), a[1], mix(a[2], b[2], j / N)]);
      const pb = project(cam, [mix(a[0], b[0], (j + 1) / N), a[1], mix(a[2], b[2], (j + 1) / N)]);
      if (pa.z > near || pb.z > near) continue;
      const depth = PERSP - (pa.z + pb.z) / 2;
      const op = Math.max(0, Math.min(1, 1.25 - depth / 4200));
      if (op < 0.02) continue;
      const sa = toScreen(pa),
        sb = toScreen(pb);
      segs.push(<line key={`${key}${j}`} x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} strokeOpacity={op * op} />);
    }
  };
  for (let i = -15; i <= 15; i++) line([i * CELL, FLOOR_Y, -3600], [i * CELL, FLOOR_Y, 2400], `c${i}`);
  for (let j = -15; j <= 10; j++) line([-3600, FLOOR_Y, j * CELL], [3600, FLOOR_Y, j * CELL], `r${j}`);
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <g stroke={alpha(C.gold, 0.32)} strokeWidth={1.4}>
        {segs}
      </g>
    </svg>
  );
};

const Glow: React.FC<{ cam: Cam; i: number; on: number; kind: "back" | "pool" }> = ({ cam, i, on, kind }) => {
  if (on < 0.02) return null;
  const p = POSES[i];
  const q = kind === "back" ? project(cam, [p.x, p.y - 60, p.z - 300]) : project(cam, [p.x, FLOOR_Y, p.z]);
  if (q.z > PERSP - 200) return null;
  const s = toScreen(q);
  const w = (kind === "back" ? 2500 : 1600) * s.k,
    h = (kind === "back" ? 1250 : 270) * s.k;
  const bg =
    kind === "back"
      ? `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha("#f6dfa6", 0.24 * on)} 0%, ${alpha("#c9973a", 0.09 * on)} 46%, ${alpha("#c9973a", 0)} 72%)`
      : `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha(C.gold, 0.26 * on)} 0%, ${alpha(C.gold, 0.08 * on)} 45%, ${alpha(C.gold, 0)} 72%)`;
  return <div style={{ position: "absolute", left: s.x - w / 2, top: s.y - h / 2, width: w, height: h, borderRadius: "50%", background: bg }} />;
};

// ── syntax colour, BoardDream's night palette ──
const KEYWORDS = new Set(["const", "let", "for", "if", "try", "catch", "await", "async", "export", "function", "return", "new", "of", "in"]);
const tokenize = (line: string): [string, string][] => {
  const out: [string, string][] = [];
  const re = /(\/\*\*.*?\*\/|\/\/.*$)|(`[^`]*`|"[^"]*"|'[^']*')|(\b\d[\d_]*\b)|([A-Za-z_$][\w$]*)|(\s+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[1]) out.push([m[1], "#9c8a73"]);
    else if (m[2]) out.push([m[2], "#8fd3c9"]);
    else if (m[3]) out.push([m[3], "#f0a37a"]);
    else if (m[4]) out.push([m[4], KEYWORDS.has(m[4]) ? GOLD : /^[A-Z]/.test(m[4]) ? "#e6c38f" : CREAM]);
    else out.push([m[5], "#cdbfa8"]);
  }
  return out;
};

const LINE_H = 35;
const CODE_PX = 26;

const CodeWindow: React.FC<{ i: number; t: number; focus: number }> = ({ i, t, focus }) => {
  const w = WINDOWS[i];
  const printAt = i === 0 ? 0.04 : i === 1 ? FLY[0][0] + 0.25 : ARRIVE[i] - 0.3;
  const hot = ramp(t, ARRIVE[i] + 0.1, 0.32, EZ.snappy);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 20,
        overflow: "hidden",
        background: "linear-gradient(180deg, #2b231b 0%, #211a14 35%, #18120d 100%)",
        boxShadow: `inset 0 0 0 1.5px ${alpha(GOLD, 0.12 + 0.12 * focus)}, inset 0 2px 0 ${alpha("#ffffff", 0.06 + 0.08 * focus)}`,
        fontFamily: F.mono,
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 70, display: "flex", alignItems: "center", gap: 14, padding: "0 30px", borderBottom: `1.5px solid ${alpha(GOLD, 0.1)}`, background: alpha("#ffffff", 0.03) }}>
        {[0, 1, 2].map((k) => (
          <div key={k} style={{ width: 16, height: 16, borderRadius: 8, background: alpha(CREAM, 0.18) }} />
        ))}
        <div style={{ marginLeft: 20, fontSize: 28, fontWeight: 600, color: GOLD }}>{w.step}</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: CREAM }}>{w.path}</div>
        <div style={{ marginLeft: "auto", fontFamily: F.ui, fontSize: 22, fontWeight: 600, color: alpha(CREAM, 0.5), letterSpacing: "0.08em" }}>TYPESCRIPT · OUR CODE</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 96 }}>
        {w.lines.map((ln, k) => {
          const p = ramp(t, printAt + k * 0.022, 0.1, EZ.snappy);
          if (p <= 0) return null;
          const isHot = k === w.hot;
          return (
            <div key={k} style={{ position: "absolute", left: 0, right: 0, top: k * LINE_H, height: LINE_H }}>
              {isHot ? (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: -2,
                    bottom: -2,
                    background: `linear-gradient(90deg, ${alpha(C.gold, 0.32)} 0%, ${alpha(C.gold, 0.16)} 100%)`,
                    borderLeft: `6px solid ${C.gold}`,
                    transform: `scaleX(${hot})`,
                    transformOrigin: "left center",
                  }}
                />
              ) : null}
              <div style={{ position: "absolute", left: 40, top: 2, fontSize: CODE_PX, lineHeight: `${LINE_H - 4}px`, whiteSpace: "pre", opacity: Math.min(1, p * 1.8), transform: `translateX(${(1 - p) * -10}px)`, fontWeight: isHot ? 600 : 400 }}>
                {tokenize(ln).map(([s, c], j) => (
                  <span key={j} style={{ color: isHot && c === "#9c8a73" ? "#f6e3b4" : c }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CodeSpace: React.FC<{ t: number }> = ({ t }) => {
  const cam = camAt(t);
  const a = camAt(t - 1 / 60),
    b = camAt(t + 1 / 60);
  const kS = PERSP / (PERSP + cam.pull);
  const vx = -(b.pose.x - a.pose.x) * kS * 15;
  const vy = -(b.pose.y - a.pose.y) * kS * 15;
  const shake = shakeAt(t);
  const flash = t >= DROP ? Math.exp(-((t - DROP) * 30) / 2.6) : 0;
  const world = `translateZ(${(-cam.pull).toFixed(2)}px) rotateX(${TILT}deg) rotateY(${cam.yaw.toFixed(3)}deg) translate3d(${(-cam.pose.x).toFixed(2)}px,${(-cam.pose.y).toFixed(2)}px,${(-cam.pose.z).toFixed(2)}px)`;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 85% 70% at 40% 30%, #3a2e22 0%, ${C.night} 62%, #0d0907 100%)` }}>
      <Floor cam={cam} />
      {[0, 1, 2].map((i) => (
        <Glow key={`b${i}`} cam={cam} i={i} kind="back" on={Math.max(0, 1 - Math.abs(cam.s - i))} />
      ))}
      {[0, 1, 2].map((i) => (
        <Glow key={`p${i}`} cam={cam} i={i} kind="pool" on={Math.max(0, 1 - Math.abs(cam.s - i))} />
      ))}
      <SpeedBlur vx={vx} vy={vy} amount={0.14} max={10}>
        <div style={{ position: "absolute", inset: 0, transform: `translate(${shake.sx.toFixed(2)}px, ${shake.sy.toFixed(2)}px) rotate(${shake.rot.toFixed(3)}deg)` }}>
        <div style={{ position: "absolute", inset: 0, perspective: PERSP, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 960, top: 540, width: 0, height: 0, transformStyle: "preserve-3d", transform: world }}>
            {POSES.map((p, i) => {
              const wide = Math.min(1, Math.max(0, cam.pull / PULL_PEAK));
              const focus = Math.min(1, Math.max(0, 1 - Math.abs(cam.s - i) * 1.25) + wide * 0.45);
              const blur = (1 - focus) * 3;
              return (
                <React.Fragment key={i}>
                  <div
                    style={{
                      position: "absolute",
                      left: -W / 2 - 140,
                      top: -H / 2 - 300,
                      whiteSpace: "nowrap",
                      transform: `translate3d(${p.x}px,${p.y}px,${p.z - 380}px) rotateY(${p.ry}deg)`,
                      fontFamily: F.display,
                      fontSize: 560,
                      fontWeight: 700,
                      lineHeight: 1,
                      color: "transparent",
                      WebkitTextStroke: `2px ${alpha(C.gold, 0.08 + 0.3 * focus)}`,
                    }}
                  >
                    {WINDOWS[i].step}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      left: -W / 2,
                      top: -H / 2,
                      width: W,
                      height: H,
                      transform: `translate3d(${p.x}px,${p.y}px,${p.z}px) rotateY(${p.ry}deg)`,
                      borderRadius: 20,
                      boxShadow: `0 50px 120px ${alpha("#000000", 0.65)}, 0 0 0 1px ${alpha("#000000", 0.4)}, 0 0 90px ${alpha(C.gold, 0.08 * focus)}`,
                      filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px) brightness(${(0.62 + 0.38 * focus).toFixed(3)})` : undefined,
                      opacity: 0.72 + 0.28 * focus,
                    }}
                  >
                    <CodeWindow i={i} t={t} focus={focus} />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
        </div>
      </SpeedBlur>
      {/* the drop's warm exposure flash, decaying over ~8f of 30 */}
      {flash > 0.01 ? <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${alpha("#fff3d6", 0.55 * flash)} 0%, ${alpha(C.gold, 0.28 * flash)} 55%, ${alpha(C.gold, 0.1 * flash)} 100%)`, mixBlendMode: "screen" }} /> : null}
      <Kicker text="Our code · written during the hackathon" at={0.05} x={960} y={112} color={GOLD} />
      {WINDOWS.map((w, i) => (
        <Caption key={i} text={w.label} at={i === 0 ? 0 : ARRIVE[i]} out={i < 2 ? ARRIVE[i + 1] - 0.34 : undefined} x={960} y={915} size={58} color={CREAM} stagger={0.03} />
      ))}
    </AbsoluteFill>
  );
};
