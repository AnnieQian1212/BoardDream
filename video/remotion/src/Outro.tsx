import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandMark } from "./fx";
import { EASE, Grain, SpeedBlur, ramp, velocity } from "./shotcraft/Polish";
import { C, DISPLAY, UI } from "./theme";

/**
 * The closing group photo, after video-shotcraft's outro-group-photo-launch card
 * (demos/outro/outro-group-photo-launch/OutroGroupPhotoLaunch.tsx): one piece of every thing the
 * film showed flies in from its side and settles around the mark, the mark and the name are pressed
 * in letter by letter while the others step back, under a slow crane-in, a light sweep, a stage
 * light and rising gold dust. The card's timings are kept, on its 30 fps clock (`f`), whatever the
 * film's rate. The pieces are stills cut from the takes (cut-outro.mts) and the game art.
 */

const FLY_EASE = Easing.bezier(0.34, 1.4, 0.44, 1);
const CRANE_EASE = Easing.bezier(0.3, 0, 0.2, 1);
const PRESS = Easing.bezier(0.2, 0.75, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Piece = { key: string; src: string; w: number; h: number; cx: number; cy: number; rot: number; dx: number; dy: number; radius: number; cue: number };

// Render order = cue order, so later arrivals stack on top. Sizes are as shown.
const PIECES: Piece[] = [
  { key: "idea", src: "outro/idea.png", w: 414, h: 90, cx: 600, cy: 178, rot: -2, dx: 0, dy: -260, radius: 12, cue: 4 },
  { key: "making", src: "outro/making.png", w: 158, h: 312, cx: 214, cy: 470, rot: -4, dx: -440, dy: 0, radius: 12, cue: 7 },
  { key: "versions", src: "outro/versions.png", w: 207, h: 216, cx: 1700, cy: 300, rot: 4, dx: 460, dy: -100, radius: 12, cue: 10 },
  { key: "table", src: "outro/table.png", w: 374, h: 218, cx: 1290, cy: 168, rot: 2.5, dx: 300, dy: -320, radius: 12, cue: 13 },
  { key: "balance", src: "outro/balance.png", w: 195, h: 221, cx: 1712, cy: 762, rot: -3, dx: 420, dy: 240, radius: 12, cue: 16 },
  { key: "mochi", src: "outro/mochi.png", w: 395, h: 93, cx: 700, cy: 938, rot: 2, dx: -200, dy: 320, radius: 12, cue: 19 },
  { key: "cover", src: "covers/tidehearth-mw0zl535.webp", w: 300, h: 200, cx: 300, cy: 852, rot: 3, dx: -400, dy: 300, radius: 14, cue: 22 },
  { key: "rivals", src: "outro/rivals.png", w: 323, h: 49, cx: 1290, cy: 958, rot: -2, dx: 260, dy: 320, radius: 10, cue: 25 },
  { key: "card", src: "concept/card-cinder-sprout.webp", w: 128, h: 186, cx: 1690, cy: 532, rot: 5, dx: 420, dy: 0, radius: 10, cue: 28 },
];

// Gold dust and soft foreground motes, every parameter derived from the index (the same each render).
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

const NAME = "BoardDream".split("");

export const Outro: React.FC<{ seconds: number }> = ({ seconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = (frame * 30) / fps;
  const duration = seconds * 30;

  const blur = interpolate(f, [0, 24], [0, 14], { ...clamp, easing: Easing.bezier(0.4, 0, 0.4, 1) });
  const rule = interpolate(f, [58, 70], [0, 1], { ...clamp, easing: CRANE_EASE });
  const tag = ramp(f, 68, 12, EASE.out);
  const url = ramp(f, 76, 12, EASE.out);
  const fadeOut = 1 - ramp(f, duration - 10, 9, EASE.exit);
  const recede = interpolate(f, [42, 50], [0, 1], clamp);
  const craneT = interpolate(f, [0, 40], [0, 1], { ...clamp, easing: CRANE_EASE });
  const pushT = ramp(f, 36, duration - 36, EASE.smooth);
  const camScale = 1.06 - 0.06 * craneT + 0.035 * pushT;
  const camTilt = 4 * (1 - craneT);
  const sweepX = interpolate(f, [2, 14], [-700, 2020], { ...clamp, easing: Easing.bezier(0.4, 0, 0.6, 1) });
  const sweepOpacity = interpolate(f, [2, 5, 11, 14], [0, 0.12, 0.12, 0], clamp);
  const stageLight = interpolate(f, [42, 50, 58], [0, 0.55, 0.32], clamp);
  const vignette = interpolate(f, [42, 54], [0, 0.1], clamp);
  const ruleExt = interpolate(f, [58, 66], [0, 1], { ...clamp, easing: CRANE_EASE });
  const ruleExtFade = interpolate(f, [66, 72], [1, 0], clamp);
  const spacing = interpolate(f, [62, 66], [-0.01, 0.005], { ...clamp, easing: CRANE_EASE });
  const press = (from: number) => interpolate(f, [from, from + 8], [0, 1], { ...clamp, easing: PRESS });

  return (
    <AbsoluteFill style={{ background: C.night }}>
      <AbsoluteFill style={{ opacity: fadeOut }}>
        <AbsoluteFill style={{ transform: `perspective(1400px) rotateX(${camTilt}deg) scale(${camScale})`, transformOrigin: "50% 45%" }}>
          {/* The home page, falling out of focus behind the photo. */}
          <AbsoluteFill style={{ filter: `blur(${blur}px)`, transform: "scale(1.04)" }}>
            <Img src={staticFile("outro/home.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </AbsoluteFill>
          <AbsoluteFill style={{ background: "radial-gradient(1200px 800px at 50% 48%, rgba(251,245,232,0.84), rgba(251,245,232,0.58) 60%, rgba(251,245,232,0.38))" }} />
          <AbsoluteFill>
            {PIECES.map((el) => {
              if (f < el.cue) return null;
              const t = interpolate(f, [el.cue, el.cue + 12], [0, 1], { ...clamp, easing: FLY_EASE });
              const opacity = interpolate(f, [el.cue, el.cue + 3], [0, 1], clamp);
              const posAt = (fr: number) => {
                const tt = interpolate(fr, [el.cue, el.cue + 12], [0, 1], { ...clamp, easing: FLY_EASE });
                return [el.dx * (1 - tt), el.dy * (1 - tt)];
              };
              const vx = velocity((fr) => posAt(fr)[0], f);
              const vy = velocity((fr) => posAt(fr)[1], f);
              const land = interpolate(f, [el.cue + 9, el.cue + 12, el.cue + 16], [0, 1, 0], clamp);
              const air = Math.max(0, 1 - t);
              const shadow =
                land > 0.01
                  ? `0 ${10 - 5 * land}px ${24 - 12 * land}px rgba(30,25,18,${0.16 + 0.06 * land}), 0 2px 6px rgba(30,25,18,${0.08 + 0.06 * land})`
                  : `0 ${10 + 26 * air}px ${24 + 46 * air}px rgba(30,25,18,${0.16 + 0.1 * air}), 0 2px 6px rgba(30,25,18,.08)`;
              return (
                <SpeedBlur key={el.key} vx={vx} vy={vy} amount={0.3} max={22}>
                  <div
                    style={{
                      position: "absolute",
                      left: el.cx - el.w / 2,
                      top: el.cy - el.h / 2,
                      width: el.w,
                      height: el.h,
                      transform: `translate(${el.dx * (1 - t)}px, ${el.dy * (1 - t)}px) rotate(${el.rot * (2 - t)}deg) scale(${(1.12 - 0.12 * t) * (1 - 0.015 * land)})`,
                      borderRadius: el.radius,
                      overflow: "hidden",
                      boxShadow: shadow,
                      background: C.paper,
                      opacity: opacity * (1 - 0.12 * recede),
                      filter: `saturate(${1 - 0.08 * recede})`,
                    }}
                  >
                    <Img src={staticFile(el.src)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                </SpeedBlur>
              );
            })}
          </AbsoluteFill>
        </AbsoluteFill>

        <AbsoluteFill style={{ pointerEvents: "none" }}>
          {DUST.map((d, i) => {
            const y = (((d.y0 - f * d.rise) % 1080) + 1080) % 1080;
            const x = d.x + Math.sin(f * d.swayFreq + d.phase) * d.swayAmp;
            const twinkle = 0.7 + 0.3 * Math.sin(f * 0.21 + d.phase * 3);
            return (
              <div
                key={i}
                style={{ position: "absolute", left: x, top: y, width: d.size, height: d.size, borderRadius: "50%", background: "oklch(78% 0.085 80)", opacity: d.opacity * twinkle, boxShadow: `0 0 ${d.size * 2.5}px ${d.size * 0.6}px oklch(84% 0.08 82 / 0.6)` }}
              />
            );
          })}
          {BOKEH.map((b, i) => {
            const y = (((b.y0 - f * b.rise) % 1180) + 1180) % 1180 - 50;
            return (
              <div
                key={`b${i}`}
                style={{ position: "absolute", left: b.x, top: y, width: b.size, height: b.size, borderRadius: "50%", background: "radial-gradient(circle, oklch(86% 0.1 82 / 0.9) 0%, oklch(86% 0.1 82 / 0.35) 55%, oklch(86% 0.1 82 / 0) 72%)", opacity: b.opacity, filter: "blur(2px)" }}
              />
            );
          })}
        </AbsoluteFill>

        {sweepOpacity > 0 && (
          <AbsoluteFill style={{ mixBlendMode: "overlay" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: sweepX - 300, width: 600, background: "linear-gradient(90deg, rgba(255,244,224,0), rgba(255,244,224,1) 50%, rgba(255,244,224,0))", opacity: sweepOpacity }} />
          </AbsoluteFill>
        )}
        {stageLight > 0 && <AbsoluteFill style={{ background: "radial-gradient(760px 380px at 960px 470px, rgba(255,246,228,0.95), rgba(255,246,228,0.35) 55%, rgba(255,246,228,0) 75%)", opacity: stageLight }} />}
        {vignette > 0 && <AbsoluteFill style={{ background: "radial-gradient(1400px 900px at 50% 50%, rgba(62,48,32,0) 55%, rgba(62,48,32,0.7) 100%)", opacity: vignette }} />}

        {/* The mark and the name, pressed in. */}
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ textAlign: "center", marginTop: -40 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: DISPLAY, fontSize: 124, fontWeight: 650, lineHeight: 1.12, color: C.ink, letterSpacing: `${0.01 + spacing}em`, textShadow: "0 1px 0 rgba(255,253,248,0.75), 0 14px 36px rgba(60,44,24,0.16)" }}>
              <div style={{ marginRight: 30, opacity: press(38), transform: `translateY(${(1 - press(38)) * 28}px) scale(${1.35 - 0.35 * press(38)})`, filter: press(38) < 0.995 ? `blur(${(1 - press(38)) * 8}px)` : undefined }}>
                <BrandMark size={140} />
              </div>
              {NAME.map((ch, i) => {
                const p = press(Math.round(42 + i * 1.8));
                return (
                  <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 28}px) scale(${1.35 - 0.35 * p})`, filter: p < 0.995 ? `blur(${(1 - p) * 8}px)` : undefined }}>
                    {ch}
                  </span>
                );
              })}
            </div>
            <div style={{ position: "relative", height: 6, width: 300, margin: "30px auto 0" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 3, background: C.gold, transform: `scaleX(${rule})` }} />
              {ruleExt > 0 && ruleExtFade > 0 && (
                <>
                  <div style={{ position: "absolute", top: 2.5, height: 1, right: "100%", width: 190 * ruleExt, background: C.gold, opacity: ruleExtFade }} />
                  <div style={{ position: "absolute", top: 2.5, height: 1, left: "100%", width: 190 * ruleExt, background: C.gold, opacity: ruleExtFade }} />
                </>
              )}
            </div>
            <div style={{ fontFamily: DISPLAY, fontStyle: "italic", fontSize: 50, color: C.ink, marginTop: 26, opacity: tag, transform: `translateY(${(1 - tag) * 6}px)` }}>Dream it up. Play it tonight.</div>
            <div style={{ fontFamily: UI, fontSize: 36, fontWeight: 700, letterSpacing: "0.04em", color: "#9a6a12", marginTop: 18, opacity: url, transform: `translateY(${(1 - url) * 6}px)` }}>boarddream.pages.dev</div>
          </div>
        </AbsoluteFill>
        <Grain opacity={0.045} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
