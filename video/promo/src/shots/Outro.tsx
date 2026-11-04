// Shot 11, bars 56–62.5 (12.0 s): the group photo (shotcraft outro-group-photo-launch, from
// demos/outro/outro-group-photo-launch/OutroGroupPhotoLaunch.tsx, its 30 fps timings in seconds).
// A piece of every feature shown flies in from all sides around the mark, cut from the app's own
// stills (src/shots/outro/crop.py): the made game's painted board, its making, the steps with the
// rules as code, a card in hand, the mochi steamer, the friends' table, Behind the scenes, the idea
// box, the print-and-play board, and the four Meta models, on the music's dip. The mark stamps on bar 58
// (the last full section), BoardDream and the address follow and hold still through the music's fall
// (bar 61) and tail; the lights go down only in the last 0.7 s.
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { C, F, displaySoft } from "../lib/theme";
import { EASE, prog, useSec } from "../lib/time";
import { Mark, ModelChip } from "../lib/ui";
import { SpeedBlur } from "./outro/SpeedBlur";
import pieces from "../../public/shots/outro/pieces.json";

const FLY = (x: number) => {
  // the card's bezier(0.34, 1.4, 0.44, 1): a real overshoot on landing
  return bez(0.34, 1.4, 0.44, 1)(x);
};
function bez(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sx(t) - x;
      const d = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(dx) < 1e-6 || d === 0) break;
      t -= dx / d;
    }
    return sy(t);
  };
}

type Placement = { cx: number; cy: number; scale: number; rot: number; dx: number; dy: number; radius: number };

/** Where each piece settles (screen px), how it is scaled and turned, and where it flies in from. */
const PLACE: Record<string, Placement> = {
  board: { cx: 300, cy: 250, scale: 0.68, rot: -4, dx: -520, dy: -120, radius: 14 },
  making: { cx: 760, cy: 140, scale: 0.7, rot: -1.5, dx: 0, dy: -300, radius: 10 },
  idea: { cx: 1215, cy: 128, scale: 0.6, rot: 1.5, dx: 120, dy: -300, radius: 12 },
  card: { cx: 1560, cy: 262, scale: 1.2, rot: 6, dx: 480, dy: -160, radius: 9 },
  steps: { cx: 122, cy: 682, scale: 0.5, rot: 3, dx: -420, dy: 0, radius: 10 },
  print: { cx: 1770, cy: 560, scale: 0.48, rot: 4, dx: 440, dy: 0, radius: 10 },
  room: { cx: 1590, cy: 846, scale: 0.52, rot: -4, dx: 420, dy: 260, radius: 12 },
  stats: { cx: 1010, cy: 948, scale: 0.7, rot: -1.5, dx: 0, dy: 320, radius: 12 },
  mochi: { cx: 438, cy: 922, scale: 0.85, rot: 2.5, dx: -380, dy: 300, radius: 12 },
};

/** The order they arrive in (render order = cue order: later arrivals stack on top). */
const ORDER = ["board", "making", "card", "idea", "steps", "print", "room", "stats", "mochi"];

const CHIPS: { name: string; cx: number; cy: number; rot: number; dx: number; dy: number; tone: "teal" | "gold" | "ink" }[] = [
  { name: "Muse Spark", cx: 668, cy: 318, rot: -3, dx: -200, dy: -260, tone: "teal" },
  { name: "Muse Image", cx: 300, cy: 470, rot: 3, dx: -360, dy: 60, tone: "gold" },
  { name: "SAM 3.1", cx: 1300, cy: 318, rot: 2.5, dx: 260, dy: -260, tone: "ink" },
  { name: "Muse Spark Open", cx: 1520, cy: 640, rot: -2, dx: 380, dy: 40, tone: "teal" },
];

// Paced for the music's dip (bars 56–57): the card's 12f flights and 3f cues slowed to 0.55 s
// flights landing on eighth notes, the pieces from 0.69 s to 2.54 s, the model chips to 3.46 s.
const FLIGHT = 0.55;
const LAND0 = 0.692;
const EIGHTH = 0.23078;
const CUE = (i: number) => LAND0 + i * EIGHTH - FLIGHT;
const MARK_AT = 3.29; // the stamp lands on bar 58 (3.692 s), where the music's last full section begins
const MARK_DUR = 0.4;
const LETTER_AT = (i: number) => 3.6 + i * 0.07;
const LETTER_DUR = 0.35;
const RULE: [number, number] = [4.154, 4.6];
const TAG: [number, number] = [4.615, 5.05]; // the address and the hackathon line, held still to the end
const FADE: [number, number] = [11.3, 12.0]; // the lights go down only in the tail; the last frame is dark

const DUST = Array.from({ length: 20 }, (_, i) => ({
  x: (i * 439 + 137) % 1920,
  y0: (i * 613 + 271) % 1080,
  rise: 0.3 + (i % 5) * 0.11,
  swayAmp: 9 + (i % 4) * 5,
  swayFreq: 0.022 + (i % 3) * 0.008,
  phase: (i * 0.83) % (Math.PI * 2),
  size: 2.4 + (i % 3) * 0.9,
  opacity: 0.35 + ((i * 7) % 5) * 0.09,
}));
const BOKEH = Array.from({ length: 6 }, (_, i) => ({
  x: (i * 701 + 260) % 1920,
  y0: (i * 389 + 640) % 1080,
  rise: 0.55 + (i % 3) * 0.2,
  size: 14 + (i % 3) * 7,
  opacity: 0.1 + (i % 2) * 0.06,
}));

type Piece = { name: string; w: number; h: number };
const DATA = pieces as unknown as { background: string; pieces: Piece[] };
const BY_NAME = Object.fromEntries(DATA.pieces.map((p) => [p.name, p]));

/** A flying element: offset from its seat, turned, scaled up in the air, motion-blurred, landing with a press. */
const Flyer: React.FC<{ t: number; cue: number; p: Placement; w: number; h: number; recede: number; id: string; children: React.ReactNode; plain?: boolean }> = ({ t, cue, p, w, h, recede, id, children, plain }) => {
  if (t < cue) return null;
  const k = FLY(Math.min(1, Math.max(0, (t - cue) / FLIGHT)));
  const opacity = prog(t, cue, cue + 0.1, (x) => x);
  const pos = (tt: number) => {
    const kk = FLY(Math.min(1, Math.max(0, (tt - cue) / FLIGHT)));
    return [p.dx * (1 - kk), p.dy * (1 - kk)];
  };
  const [x, y] = pos(t);
  const v0 = pos(t - 1 / 60);
  const v1 = pos(t + 1 / 60);
  const vx = v1[0] - v0[0]; // px per 1/30 s, the card's unit
  const vy = v1[1] - v0[1];
  const rot = p.rot * (2 - k);
  const scale = p.scale * (1.12 - 0.12 * k);
  const air = Math.max(0, 1 - k);
  const land = interpolate(t, [cue + 0.75 * FLIGHT, cue + FLIGHT, cue + 1.33 * FLIGHT], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shadow =
    land > 0.01
      ? `0 ${10 - 5 * land}px ${24 - 12 * land}px rgba(30,25,18,${0.2 + 0.06 * land}), 0 2px 6px rgba(30,25,18,${0.1 + 0.06 * land})`
      : `0 ${10 + 26 * air}px ${24 + 46 * air}px rgba(30,25,18,${0.2 + 0.1 * air}), 0 2px 6px rgba(30,25,18,.1)`;
  return (
    <SpeedBlur vx={vx} vy={vy} amount={0.3} max={22} id={id}>
      <div
        style={{
          position: "absolute",
          left: p.cx - w / 2,
          top: p.cy - h / 2,
          width: w,
          height: h,
          transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale * (1 - 0.015 * land)})`,
          transformOrigin: "center center",
          borderRadius: p.radius / Math.max(0.3, p.scale),
          overflow: plain ? "visible" : "hidden",
          boxShadow: plain ? undefined : shadow,
          border: plain ? undefined : `${1.5 / p.scale}px solid ${C.ink}`,
          opacity: opacity * (1 - 0.12 * recede),
          filter: `saturate(${1 - 0.08 * recede})`,
          background: plain ? undefined : C.panel,
        }}
      >
        {children}
      </div>
    </SpeedBlur>
  );
};

export const Outro: React.FC = () => {
  const t = useSec();
  const blur = prog(t, 0, 1.2, EASE.inOut) * 14;
  const recede = prog(t, MARK_AT, MARK_AT + MARK_DUR, (x) => x);
  const crane = prog(t, 0, 2.0, EASE.cam);
  const push = prog(t, 1.8, FADE[1], EASE.inOut);
  const camScale = 1.06 - 0.06 * crane + 0.025 * push;
  const camTilt = 4 * (1 - crane);
  const sweepX = interpolate(t, [0.1, 0.7], [-700, 2020], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });
  const sweepOpacity = interpolate(t, [0.1, 0.25, 0.55, 0.7], [0, 0.14, 0.14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const stageLight = interpolate(t, [MARK_AT, MARK_AT + MARK_DUR, MARK_AT + 0.8], [0, 0.6, 0.38], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vignette = interpolate(t, [MARK_AT, MARK_AT + 0.6], [0, 0.12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rule = prog(t, RULE[0], RULE[1], EASE.cam);
  const ruleExt = prog(t, RULE[0], RULE[0] + 0.27, EASE.cam);
  const ruleExtFade = 1 - prog(t, RULE[0] + 0.27, RULE[0] + 0.47, (x) => x);
  const tag = prog(t, TAG[0], TAG[1], EASE.out);
  const fade = prog(t, FADE[0], FADE[1], EASE.inOut);
  const spacing = interpolate(t, [4.6, 4.75], [-0.015, 0.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const f30 = t * 30; // the dust drifts in the card's 30 fps units

  const markK = prog(t, MARK_AT, MARK_AT + MARK_DUR, (x) => 1 - Math.pow(1 - x, 3));

  return (
    <AbsoluteFill style={{ background: C.night }}>
      <AbsoluteFill style={{ opacity: 1 - fade }}>
        <AbsoluteFill style={{ transform: `perspective(1400px) rotateX(${camTilt}deg) scale(${camScale})`, transformOrigin: "50% 45%" }}>
          {/* the made game's table behind everything, going out of focus */}
          <Img src={staticFile(`cap/${DATA.background}.png`)} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, filter: `blur(${blur}px)`, transform: "scale(1.04)" }} />
          <AbsoluteFill style={{ background: "radial-gradient(1200px 800px at 50% 48%, rgba(251,243,225,0.86), rgba(245,234,210,0.66) 60%, rgba(234,220,192,0.5))" }} />
          {/* the group photo */}
          <AbsoluteFill>
            {ORDER.filter((n) => BY_NAME[n] && PLACE[n]).map((n, i) => {
              const pc = BY_NAME[n];
              return (
                <Flyer key={n} id={`fly-${n}`} t={t} cue={CUE(i)} p={PLACE[n]} w={pc.w} h={pc.h} recede={recede}>
                  <Img src={staticFile(`shots/outro/${n}.png`)} style={{ position: "absolute", inset: 0, width: pc.w, height: pc.h, display: "block" }} />
                </Flyer>
              );
            })}
            {CHIPS.map((c, i) => (
              <Flyer
                key={c.name}
                id={`chip-${i}`}
                t={t}
                cue={CUE(ORDER.length + i)}
                p={{ cx: c.cx, cy: c.cy, scale: 1, rot: c.rot, dx: c.dx, dy: c.dy, radius: 999 }}
                w={420}
                h={60}
                recede={recede}
                plain
              >
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ModelChip name={c.name} size={32} tone={c.tone} style={{ boxShadow: "0 8px 20px rgba(45,32,22,0.18)", background: c.tone === "ink" ? "#efe6d3" : c.tone === "gold" ? "#f6e3b3" : "#d9efef", border: `1.5px solid ${C.ink}` }} />
                </div>
              </Flyer>
            ))}
          </AbsoluteFill>
        </AbsoluteFill>

        {/* gold dust and out-of-focus motes in front */}
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          {DUST.map((d, i) => {
            const y = (((d.y0 - f30 * d.rise) % 1080) + 1080) % 1080;
            const x = d.x + Math.sin(f30 * d.swayFreq + d.phase) * d.swayAmp;
            const tw = 0.7 + 0.3 * Math.sin(f30 * 0.21 + d.phase * 3);
            return (
              <div key={i} style={{ position: "absolute", left: x, top: y, width: d.size, height: d.size, borderRadius: "50%", background: "#e9c46a", opacity: d.opacity * tw, boxShadow: `0 0 ${d.size * 2.5}px ${d.size * 0.6}px rgba(242,207,124,0.6)` }} />
            );
          })}
          {BOKEH.map((b, i) => {
            const y = ((((b.y0 - f30 * b.rise) % 1180) + 1180) % 1180) - 50;
            return (
              <div key={`b${i}`} style={{ position: "absolute", left: b.x, top: y, width: b.size, height: b.size, borderRadius: "50%", background: "radial-gradient(circle, rgba(246,217,139,0.9) 0%, rgba(246,217,139,0.35) 55%, rgba(246,217,139,0) 72%)", opacity: b.opacity, filter: "blur(2px)" }} />
            );
          })}
        </AbsoluteFill>

        {sweepOpacity > 0 ? (
          <AbsoluteFill style={{ mixBlendMode: "overlay", pointerEvents: "none" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: sweepX - 300, width: 600, background: "linear-gradient(90deg, rgba(255,244,224,0), rgba(255,244,224,1) 50%, rgba(255,244,224,0))", opacity: sweepOpacity }} />
          </AbsoluteFill>
        ) : null}
        {stageLight > 0 ? (
          <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(760px 400px at 960px 520px, rgba(255,247,230,0.97), rgba(255,247,230,0.45) 55%, rgba(255,247,230,0) 76%)", opacity: stageLight }} />
        ) : null}
        {vignette > 0 ? <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(1400px 900px at 50% 50%, rgba(62,48,32,0) 55%, rgba(62,48,32,0.7) 100%)", opacity: vignette }} /> : null}

        {/* the sign-off */}
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", marginTop: 30 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: F.display,
                ...displaySoft,
                fontSize: 150,
                fontWeight: 600,
                lineHeight: 1.1,
                color: C.ink,
                letterSpacing: `${spacing}em`,
                textShadow: "0 1px 0 rgba(255,253,248,0.75), 0 14px 36px rgba(60,44,24,0.16)",
              }}
            >
              <div style={{ marginRight: 34, opacity: markK, transform: `translateY(${(1 - markK) * 28}px) scale(${1.35 - 0.35 * markK})`, filter: markK < 0.995 ? `blur(${(1 - markK) * 8}px)` : undefined }}>
                <Mark size={150} id="outro-mark" style={{ display: "block", filter: "drop-shadow(0 8px 14px rgba(70,48,25,0.25))" }} />
              </div>
              {"BoardDream".split("").map((ch, i) => {
                const k = prog(t, LETTER_AT(i), LETTER_AT(i) + LETTER_DUR, (x) => 1 - Math.pow(1 - x, 3));
                return (
                  <span key={i} style={{ display: "inline-block", opacity: k, transform: `translateY(${(1 - k) * 28}px) scale(${1.35 - 0.35 * k})`, filter: k < 0.995 ? `blur(${(1 - k) * 8}px)` : undefined }}>
                    {ch}
                  </span>
                );
              })}
            </div>
            <div style={{ position: "relative", height: 6, width: 300, margin: "26px auto 0" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 3, background: C.gold, transform: `scaleX(${rule})` }} />
              {ruleExt > 0 && ruleExtFade > 0 ? (
                <>
                  <div style={{ position: "absolute", top: 2.5, height: 1.5, right: "100%", width: 220 * ruleExt, background: C.gold, opacity: ruleExtFade }} />
                  <div style={{ position: "absolute", top: 2.5, height: 1.5, left: "100%", width: 220 * ruleExt, background: C.gold, opacity: ruleExtFade }} />
                </>
              ) : null}
            </div>
            <div style={{ marginTop: 30, opacity: tag, transform: `translateY(${(1 - tag) * 10}px)` }}>
              <div style={{ fontFamily: F.ui, fontWeight: 700, fontSize: 54, letterSpacing: "0.01em", color: C.accentStrong }}>boarddream.pages.dev</div>
              <div style={{ marginTop: 14, fontFamily: F.ui, fontWeight: 600, fontSize: 32, color: C.muted }}>
                Built at the Meta AI Developer Hackathon · Oct 26 – Nov 4, 2026
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
