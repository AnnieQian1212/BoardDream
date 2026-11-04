// The table (bars 26–28, 5.54 s; the music comes back full on bar 26): Clovefire Reach, live on its 3D table,
// Muse Spark Open playing the other seats. Real screen footage at real speed: rivals.mp4 from
// 17.90 s to 23.44 s (before the table's camera moves at 23.8 s). "Player 2 (Muse Spark Open) is
// thinking…" comes up as the table lands and is ringed on beat 4; House 2's line ("Saving oil for
// light, not tide today.", 21.133 s in the clip) appears on beat 7 and is lifted out on beat 8.
//
// Card: overhead-camera-moves · tilt-reveal (demos/camera/overhead-camera-moves/TiltReveal.tsx). The
// table window lies flat, hinged at its lower edge, only its lit far edge in view on the drop's first
// frame; the camera "lifts its head" and the table rises level with a ≤3° overshoot (86° → −2.2° →
// 0°), angle, scale, hinge, eye height and perspective on one progress. Kept from the card: flat 86°,
// overshoot 2.2°, perspective 700 → 1500, the eye above the page, layout-scale rasterizing (CSS zoom
// + the equivalent rotateX'·scaleY), one sheen, a slow push in the hold. Compressed for the drop: no
// creep (the motion starts at once), the lift in two beats so the overshoot lands on beat 2. The
// footage plays throughout, the table alive as it rises.
// Then the speech bubble is lifted out where it sits (grown in place, covering its own slot).
import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, staticFile } from "remotion";
import { C, F, displaySoft } from "../lib/theme";
import { BEAT, EASE, lerp, prog, useSec } from "../lib/time";
import { Caption, ModelChip, Stage } from "../lib/ui";
import { SpeedBlur, velocity } from "./table/fx";
import { END_PUSH, LowerThird, WIN_R, WIN_S, WIN_TOP, inWindow } from "./table/parts";

const FROM = 86; // flat, face up, hinged at the lower edge
const CREEP = 1.5 / 86;
const OVER = 1 + 2.2 / 86; // ≤ 3° past level
const LIFT0 = 0.06;
const LIFT1 = 2 * BEAT; // the overshoot peak lands on beat 2
const SETTLE = 0.3;
const S0 = 2.5;
const S1 = WIN_S;
const TOP1 = WIN_TOP;
const BOT1 = TOP1 + 1080 * S1;
const MID1 = TOP1 + (1080 * S1) / 2;
const BOT0 = 600;
const END = 5.54;

/** rivals.mp4, 60 fps: the bubble appears at 21.133 s; it should on beat 7 of the shot. */
const CLIP_FROM = Math.round((21.133 - 7 * BEAT) * 60);

// The card's tuned curves (Polish.tsx EASE.swift / EASE.smooth).
const SWIFT = Easing.bezier(0.4, 0, 0.2, 1);
const SMOOTH = Easing.bezier(0.65, 0, 0.35, 1);

const poseAt = (t: number) => {
  const creep = prog(t, 0, LIFT0, SMOOTH) * CREEP;
  const lift = prog(t, LIFT0, LIFT1, SWIFT);
  const q = lerp(creep, OVER, lift) - (OVER - 1) * prog(t, LIFT1, LIFT1 + SETTLE, SMOOTH);
  const p = lerp(creep, 1, lift);
  return {
    p,
    rotX: FROM * (1 - q),
    scale: lerp(S0, S1, p),
    bot: lerp(BOT0, BOT1, p),
    eye: lerp(BOT0 - 300, MID1, p),
    persp: lerp(700, 1500, p),
  };
};

/** House 2's speech bubble in the footage, in the page's CSS px (public/shots/table/bubble-clovefire.png, cut from 22.0 s). */
const BUBBLE = { x: 105.75, y: 236.5, w: 195.5, h: 31 };
const LIFT_AT = 7 * BEAT + 0.07;
const LANDED = 8 * BEAT;
/** The status pill "Player N (Muse Spark Open) is thinking…", ringed while the model thinks. */
const RING_AT = 4 * BEAT;

export const Table: React.FC = () => {
  const t = useSec();
  const { p, rotX, scale: s0, bot, eye, persp } = poseAt(t);
  const push = lerp(1, END_PUSH, prog(t, LIFT1 + SETTLE, END, SMOOTH));
  const scale = s0 * push;
  const botY = MID1 + (bot - MID1) * push;
  const topY = botY - 1080 * scale;
  const left = 960 - 960 * scale;

  // Equivalent rotateX'·scaleY on the layout-scale box (Q2): projects like scale(s)·rotateX(r).
  const rad = (rotX * Math.PI) / 180;
  const rEq = (Math.atan2(Math.sin(rad), scale * Math.cos(rad)) * 180) / Math.PI;
  const kEq = Math.sqrt(scale * scale * Math.cos(rad) ** 2 + Math.sin(rad) ** 2) / scale;
  const vScale = kEq * Math.abs(Math.cos((rEq * Math.PI) / 180));
  const sigma = vScale > 0.6 ? 0 : (0.55 / Math.max(0.05, vScale)) * 1.6 - 1.2;
  const flat = Math.min(1, Math.abs(rotX) / 86);

  // Where the far (upper) edge lands on screen: the lit band of the first frame.
  const Hs = 1080 * scale * kEq;
  const zFar = -Hs * Math.sin((rEq * Math.PI) / 180);
  const farY = eye + (botY - Hs * Math.cos((rEq * Math.PI) / 180) - eye) * (persp / (persp - zFar));
  const rim = Math.pow(flat, 3) * (0.6 + 0.4 * prog(t, 0, 0.2));
  const vy = -(poseAt(t + 1 / 120).rotX - poseAt(t - 1 / 120).rotX) * 7 * 0.5;
  const sheen = prog(t, 0.35, 1.05, SWIFT);
  const bgShift = lerp(-40, 0, p);

  // The lifted bubble: grown in place from its left edge, so it covers its own slot.
  const k = prog(t, LIFT_AT, LANDED, EASE.land);
  const kOut = prog(t, LIFT_AT, LANDED, EASE.out);
  const from = { x: left + BUBBLE.x * scale, cy: topY + (BUBBLE.y + BUBBLE.h / 2) * scale, w: BUBBLE.w * scale };
  const to = { x: 196, cy: 300, w: 600 };
  const bx = lerp(from.x, to.x, k);
  const bcy = lerp(from.cy, to.cy, k);
  const bw = lerp(from.w, to.w, k);
  const bh = (bw * 124) / 782;
  const bubbleVx = velocity((tt) => lerp(from.x, to.x, prog(tt, LIFT_AT, LANDED, EASE.land)), t);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateY(${bgShift}px) scale(1.1)` }}>
        <Stage />
      </AbsoluteFill>

      {/* Back light behind the window: a band along the lit edge while flat, a halo once level. */}
      <div
        style={{
          position: "absolute",
          left: 60,
          width: 1800,
          top: lerp(farY - 90, farY - 40, p),
          height: lerp(180, 900, p),
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255, 244, 214, ${0.85 * (1 - 0.5 * p)}) 0%, rgba(255, 244, 214, 0) 70%)`,
          filter: "blur(30px)",
        }}
      />

      <SpeedBlur vx={0} vy={vy} amount={0.2} max={9} id="table-lift">
        <div style={{ position: "absolute", inset: 0, perspective: persp, perspectiveOrigin: `50% ${(eye / 1080) * 100}%` }}>
          <div
            style={{
              position: "absolute",
              left,
              top: topY,
              width: 1920 * scale,
              height: 1080 * scale,
              transformOrigin: "50% 100%",
              transform: `rotateX(${rEq}deg) scaleY(${kEq})`,
              borderRadius: (WIN_R / S1) * scale,
              overflow: "hidden",
              border: `${1.5 * Math.max(1, scale)}px solid ${C.ink}`,
              boxSizing: "border-box",
              background: C.panel,
              boxShadow: `0 ${4 * p}px 0 rgba(45,32,22,${p}), 0 ${30 * scale}px ${80 * scale}px rgba(70, 48, 25, ${0.28 + 0.1 * (1 - p)})`,
            }}
          >
            {sigma > 0.5 && (
              <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
                <filter id="table-aa" x="0" y="-5%" width="100%" height="110%" colorInterpolationFilters="sRGB">
                  <feGaussianBlur stdDeviation={`0 ${sigma.toFixed(2)}`} />
                </filter>
              </svg>
            )}
            <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zoom: scale, filter: sigma > 0.5 ? "url(#table-aa)" : undefined }}>
              <OffthreadVideo src={staticFile("footage/clips/rivals.mp4")} muted trimBefore={CLIP_FROM} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }} />
            </div>
            {/* Grazing light while it lies flat: the far half sinks into shade. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(0deg, rgba(45,32,22,${0.05 * flat}) 0%, rgba(45,32,22,${0.22 * flat}) 45%, rgba(45,32,22,${0.42 * flat ** 1.5}) 100%)`,
              }}
            />
            {/* One sheen, top to bottom, as the angle passes the light (clipped to the corners). */}
            {sheen > 0 && sheen < 1 ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  mixBlendMode: "screen",
                  background: `linear-gradient(180deg, transparent ${(sheen * 130 - 30).toFixed(1)}%, rgba(255, 246, 222, ${0.32 * Math.sin(sheen * Math.PI)}) ${(sheen * 130 - 12).toFixed(1)}%, transparent ${(sheen * 130 + 6).toFixed(1)}%)`,
                }}
              />
            ) : null}
          </div>
        </div>
      </SpeedBlur>

      {/* The lit edge of the flat table: the first frame's horizon. */}
      {rim > 0.01 ? (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: farY - 60,
              height: 120,
              opacity: rim,
              background: `radial-gradient(ellipse 46% 50% at 50% 50%, rgba(242, 207, 124, 0.75) 0%, rgba(242, 207, 124, 0) 70%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: farY - 1.5,
              height: 3,
              opacity: rim,
              background: "linear-gradient(90deg, rgba(255,240,200,0) 4%, #fff1c9 32%, #ffffff 50%, #fff1c9 68%, rgba(255,240,200,0) 96%)",
              boxShadow: "0 0 14px rgba(217,162,51,0.9), 0 0 40px rgba(217,162,51,0.6)",
            }}
          />
        </>
      ) : null}

      {/* Muse Spark Open's line at the table, lifted out where it sits. */}
      {t >= LIFT_AT ? (
        <SpeedBlur vx={bubbleVx} amount={0.12} max={10} id="table-bubble">
          <div
            style={{
              position: "absolute",
              left: bx,
              top: bcy - bh / 2,
              width: bw,
              height: bh,
              borderRadius: bh * 0.3,
              boxShadow: `0 ${4 + 22 * kOut}px ${8 + 40 * kOut}px rgba(70, 48, 25, ${0.15 + 0.22 * kOut})`,
            }}
          >
            <Img src={staticFile("shots/table/bubble-clovefire.png")} style={{ width: "100%", height: "100%", display: "block" }} />
          </div>
        </SpeedBlur>
      ) : null}

      {/* The captions, on a paper lower-third over the empty end of the player's mat. */}
      <StatusRing at={RING_AT} out={LIFT_AT} push={push} />
      <LowerThird x={836} y={716} w={800} h={210} at={LIFT1 + 0.02}>
        <div style={{ position: "absolute", left: 30, top: 20, display: "flex", alignItems: "center", gap: 12, fontFamily: F.ui, fontWeight: 700, fontSize: 26, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>
          <span style={{ width: 14, height: 14, borderRadius: 99, background: "#e0533d", boxShadow: "0 0 0 4px rgba(224,83,61,0.22)" }} />
          Live · real speed
        </div>
        <Caption text="Play it tonight." at={LIFT1 + 0.1} x={28} y={56} align="left" width={700} size={66} mark={["tonight"]} />
        <SeatsLine at={RING_AT} />
      </LowerThird>
    </AbsoluteFill>
  );
};

/** "Muse Spark Open takes the empty seats", the model named where it plays. */
const SeatsLine: React.FC<{ at: number }> = ({ at }) => {
  const t = useSec();
  const k = prog(t, at, at + 0.4, EASE.land);
  const o = prog(t, at, at + 0.2);
  return (
    <div style={{ position: "absolute", left: 30, top: 146, display: "flex", alignItems: "center", gap: 14, whiteSpace: "nowrap", opacity: o, transform: `translateY(${(1 - k) * 18}px)` }}>
      <ModelChip name="Muse Spark Open" size={30} />
      <span style={{ fontFamily: F.display, ...displaySoft, fontWeight: 600, fontSize: 42, color: C.ink, letterSpacing: "-0.01em" }}>takes the empty seats</span>
    </div>
  );
};

/** A gold ring drawn round the footage's status pill, where the model is seen thinking. */
const StatusRing: React.FC<{ at: number; out: number; push: number }> = ({ at, out, push }) => {
  const t = useSec();
  const draw = prog(t, at, at + 0.4, EASE.out);
  const o = prog(t, at, at + 0.08) * (1 - prog(t, out, out + 0.25));
  if (o <= 0) return null;
  const a = inWindow(798, 1016, push);
  const b = inWindow(1122, 1076, push);
  const w = b.x - a.x;
  const h = b.y - a.y;
  const per = 2 * (w + h);
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: o }}>
      <rect x={a.x} y={a.y} width={w} height={h} rx={h / 2} fill="none" stroke={C.gold} strokeWidth={5} strokeDasharray={per} strokeDashoffset={per * (1 - draw)} style={{ filter: "drop-shadow(0 2px 6px rgba(120,80,20,0.35))" }} />
    </svg>
  );
};
