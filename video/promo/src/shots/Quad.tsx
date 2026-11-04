// Shot 9, bars 36-41 (11.08 s, the calm breakdown): everything else, one at a time. The board is
// video-shotcraft's quad-split-parallel-scenes (demos/rhythm/quad-split-parallel-scenes/
// QuadSplitParallelScenes.tsx), paced for the breakdown: each quadrant in turn comes out of its slot,
// larger, for about two seconds (4.5 beats) with its label while the others wait dimmed, then all
// four sit together, labelled, for 2.8 s. Every quadrant shows its scene from the first frame.
//   TL friends join by a link: the real invite card of Clovefire Reach (revised), its link copied
//      (invite.mp4), then two real accounts' screens at one table (friends-* stills, Aichen and Mira)
//   TR print and play: the made game's print-and-play kit (print-* stills, stitched), scrolled
//   BL the mochi game: a real round played while the game was being made (mochi.mp4, 1x)
//   BR Behind the scenes: the benchmark numbers (results-0 still), each tile lifted in turn
import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { cap, LAYOUT } from "../lib/cap";
import { C, F, displaySoft, lift } from "../lib/theme";
import { BEAT, EASE, lerp, prog, sf, useSec } from "../lib/time";
import { PageCam } from "../lib/PageCam";
import { Crop, inCrop, type Region } from "./quad/Crop";
import { VideoCrop } from "./quad/VideoCrop";
import { PrintScene } from "./quad/PrintScene";

// Grid: 8 px ink seams, rounded quadrants (the card's geometry).
const G = 8;
const QW = (1920 - 3 * G) / 2; // 948
const QH = (1080 - 3 * G) / 2; // 528
const QUADS = [
  { x: G, y: G },
  { x: 2 * G + QW, y: G },
  { x: G, y: 2 * G + QH },
  { x: 2 * G + QW, y: 2 * G + QH },
];
export const QUAD_DUR = 24 * BEAT; // 11.08 s

// Focus: landings on beats 0, 4.5, 9, 13.5; the four together from beat 18.
const LAND = [0, 4.5 * BEAT, 9 * BEAT, 13.5 * BEAT];
const GRID = 18 * BEAT;
const MOVE = 0.42;
const FOCUS = { x: 178, y: 128, z: 1.65 };

/** Slow push under every quadrant (the card's "floor motion"), accelerating gently. */
const push = (t: number, amount = 0.04) => 1 + amount * Math.pow(Math.min(1, t / QUAD_DUR), 2);

/** A quadrant's label, bottom left: the display serif, read on any of the four grounds. */
const QuadLabel: React.FC<{ text: string; at: number; dark?: boolean }> = ({ text, at, dark }) => {
  const t = useSec();
  const k = prog(t, at, at + 0.4, EASE.out);
  return (
    <div
      style={{
        position: "absolute",
        left: 34,
        bottom: 24,
        fontFamily: F.display,
        ...displaySoft,
        fontWeight: 600,
        fontSize: 48,
        lineHeight: 1.05,
        letterSpacing: "-0.01em",
        color: dark ? C.panel : C.ink,
        opacity: k,
        transform: `translateY(${(1 - k) * 18}px)`,
        filter: `blur(${(1 - k) * 10}px)`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

/** A small ink pill naming what a panel is (a person, "real round"). */
const Pill: React.FC<{ text: string; at: number; x: number; y: number; dot?: string; size?: number }> = ({ text, at, x, y, dot, size = 32 }) => {
  const t = useSec();
  const k = prog(t, at, at + 0.3, EASE.land);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `scale(${0.7 + 0.3 * k})`,
        transformOrigin: "left center",
        opacity: Math.min(1, k * 2),
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 18px",
        borderRadius: 999,
        background: C.ink,
        color: C.panel,
        fontFamily: F.ui,
        fontWeight: 650,
        fontSize: size,
        whiteSpace: "nowrap",
      }}
    >
      {dot ? <span style={{ width: 12, height: 12, borderRadius: 99, background: dot }} /> : null}
      {text}
    </div>
  );
};

// ───────────── TL: friends join by a link ─────────────
// The room card in the page (CSS px), in invite.mp4 and the friends-* stills alike.
const ROOM: Region = { x: 744, y: 96, w: 432, h: 520 };
const RK = 0.67;
const CARD = { x: 60, y: 88 };
const COPY = (() => {
  const p = inCrop(ROOM, RK, 1125, 532);
  return { x: CARD.x + p.x, y: CARD.y + p.y };
})();
// invite.mp4: "Copied" shows at 1.8 s; started at 1.34 s, the click lands at 0.46 s (beat 1).
const INVITE_FROM = 1.34;
const INVITE_END = 4.1 - INVITE_FROM; // the clip runs out here; its last frame holds
const COPY_AT = 0.46;
const SCREEN_W = 300;
const SCREEN_H = (SCREEN_W * 9) / 16;
const MIRA = { x: 420, y: 90, at: 0.92 };
const AICHEN = { x: 420, y: 90 + SCREEN_H + 10, at: 1.2 };

const Screen: React.FC<{ src: string; x: number; y: number; at: number }> = ({ src, x, y, at }) => {
  const t = useSec();
  const k = prog(t, at, at + 0.38, EASE.land);
  if (k <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: SCREEN_W,
        height: SCREEN_H,
        borderRadius: 10,
        overflow: "hidden",
        ...lift(3),
        opacity: Math.min(1, k * 2.5),
        transform: `translateX(${(1 - k) * 50}px) scale(${0.86 + 0.14 * k})`,
      }}
    >
      <Crop src={cap(src)} region={{ x: 0, y: 0, w: 1920, h: 1080 }} scale={SCREEN_W / 1920} />
    </div>
  );
};

const QuadFriends: React.FC = () => {
  const t = useSec();
  // The link flies from the Copy button to Mira's screen.
  const fly = prog(t, 0.55, 0.92, EASE.inOut);
  const flyX = lerp(COPY.x + 10, MIRA.x + SCREEN_W / 2, fly);
  const flyY = lerp(COPY.y, MIRA.y + SCREEN_H / 2, fly) - Math.sin(Math.PI * fly) * 120;
  const flyOn = t >= 0.53 && t < 1.0 ? Math.min(1, (t - 0.53) / 0.05) * (1 - prog(t, 0.9, 1.0, EASE.in)) : 0;
  const ring = t - COPY_AT;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 90% at 30% 25%, #fffaef 0%, ${C.panel} 55%, #f0e2c6 100%)` }}>
      <AbsoluteFill style={{ transform: `scale(${push(t)})`, transformOrigin: "50% 45%" }}>
        <div style={{ position: "absolute", left: CARD.x, top: CARD.y, width: ROOM.w * RK, height: ROOM.h * RK, borderRadius: 14, overflow: "hidden", ...lift(3) }}>
          <Sequence durationInFrames={sf(INVITE_END)} name="invite.mp4">
            <VideoCrop clip="invite" from={INVITE_FROM} region={ROOM} scale={RK} />
          </Sequence>
          {t >= INVITE_END - 1 / 60 ? <Crop src={staticFile("shots/quad/invite-end.png")} region={ROOM} scale={RK} /> : null}
        </div>
        {ring >= 0 && ring < 0.6 ? (
          <div
            style={{
              position: "absolute",
              left: COPY.x - 32,
              top: COPY.y - 32,
              width: 64,
              height: 64,
              borderRadius: "50%",
              border: `4px solid ${C.gold}`,
              opacity: 1 - ring / 0.6,
              transform: `scale(${0.4 + ring * 1.6})`,
            }}
          />
        ) : null}
        <Screen src="friends-friend-table" x={MIRA.x} y={MIRA.y} at={MIRA.at} />
        <Pill text="Mira" dot="#4b86d6" at={MIRA.at + 0.12} x={MIRA.x + SCREEN_W + 14} y={MIRA.y + SCREEN_H / 2 - 24} />
        <Screen src="friends-host-table" x={AICHEN.x} y={AICHEN.y} at={AICHEN.at} />
        <Pill text="Aichen" dot="#e2553f" at={AICHEN.at + 0.12} x={AICHEN.x + SCREEN_W + 14} y={AICHEN.y + SCREEN_H / 2 - 24} />
        {flyOn > 0 ? (
          <div
            style={{
              position: "absolute",
              left: flyX,
              top: flyY,
              transform: `translate(-50%, -50%) scale(${0.9 + 0.1 * Math.sin(Math.PI * fly)})`,
              opacity: flyOn,
              padding: "8px 16px",
              borderRadius: 999,
              background: C.accent,
              color: "#fff",
              fontFamily: F.ui,
              fontWeight: 650,
              fontSize: 22,
              whiteSpace: "nowrap",
              boxShadow: "0 8px 18px rgba(14,116,130,0.35)",
            }}
          >
            invite link
          </div>
        ) : null}
      </AbsoluteFill>
      <QuadLabel text="Friends join by a link" at={0.15} />
    </AbsoluteFill>
  );
};

// ───────────── BL: the mochi game, a real round ─────────────
// mochi.mp4: the strip under the making screen, at 1x, clip time = shot time + 2.05 s: the steamer
// clicked at about 5.1 s (3.05 s in), a dewdrop picked up at about 6.6 s (4.55 s in, while the panel
// has the focus), two put together at about 7.8 s (5.75 s in). The clip's last frame holds after 8.95 s.
const STRIP: Region = { x: 478, y: 936, w: 552, h: 140 };
const MK = 1.54;
const TRAY = { x: 46, y: 132 };
const MOCHI_FROM = 2.05;
const MOCHI_END = 11.0 - MOCHI_FROM;

const QuadMochi: React.FC = () => {
  const t = useSec();
  const settle = prog(t, 0, 0.35, EASE.out);
  const lineIn = prog(t, LAND[2] - 0.1, LAND[2] + 0.3, EASE.out);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(150deg, #dc6a50 0%, ${C.mochi} 48%, #b2432d 100%)` }}>
      <AbsoluteFill style={{ transform: `scale(${push(t)})`, transformOrigin: "50% 40%" }}>
        <div
          style={{
            position: "absolute",
            left: TRAY.x,
            top: 44,
            fontFamily: F.display,
            ...displaySoft,
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 44,
            color: "#fff6e6",
            opacity: lineIn,
            transform: `translateY(${(1 - lineIn) * 14}px)`,
            whiteSpace: "nowrap",
          }}
        >
          Steam a friend. Put two alike together.
        </div>
        <div
          style={{
            position: "absolute",
            left: TRAY.x,
            top: TRAY.y,
            width: STRIP.w * MK,
            height: STRIP.h * MK,
            borderRadius: 16,
            overflow: "hidden",
            ...lift(4),
            transform: `translateY(${(1 - settle) * 24}px)`,
          }}
        >
          <Sequence durationInFrames={sf(MOCHI_END)} name="mochi.mp4">
            <VideoCrop clip="mochi" from={MOCHI_FROM} region={STRIP} scale={MK} />
          </Sequence>
          {t >= MOCHI_END - 1 / 60 ? <Crop src={staticFile("shots/quad/mochi-end.png")} region={STRIP} scale={MK} /> : null}
        </div>
        <Pill text="Played while the game was made" at={LAND[2] + 0.25} x={TRAY.x} y={TRAY.y + STRIP.h * MK + 18} size={28} />
      </AbsoluteFill>
      <QuadLabel text="A game while you wait" at={LAND[2] - 0.05} dark />
    </AbsoluteFill>
  );
};

// ───────────── BR: Behind the scenes ─────────────
const STATS: Region[] = [
  { x: 585, y: 84, w: 181, h: 106 },
  { x: 775, y: 84, w: 181, h: 106 },
  { x: 965, y: 84, w: 181, h: 106 },
  { x: 1154, y: 84, w: 181, h: 106 },
];
const STAT_AT = [14.5 * BEAT, 15 * BEAT, 15.5 * BEAT, 16 * BEAT];
const BW = { x: 40, y: 30, w: 868, h: 392 };

const QuadResults: React.FC = () => {
  const t = useSec();
  const settle = prog(t, 0, 0.4, EASE.out);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 90% at 70% 20%, #f3e6cb 0%, #e6d3b0 60%, #d9c39c 100%)` }}>
      <div
        style={{
          position: "absolute",
          left: BW.x,
          top: BW.y,
          width: BW.w,
          height: BW.h,
          borderRadius: 16,
          overflow: "hidden",
          ...lift(4),
          transform: `translateY(${(1 - settle) * 24}px)`,
          background: "#efe5d3",
        }}
      >
        <PageCam
          src={cap("results-0")}
          viewW={BW.w}
          viewH={BW.h}
          keys={[
            { t: 0, cx: 960, cy: 200, zoom: 1.0 },
            { t: LAND[3], cx: 960, cy: 190, zoom: 1.02 },
            { t: LAND[3] + 1.2, cx: 960, cy: 172, zoom: 1.07 },
            { t: QUAD_DUR, cx: 960, cy: 166, zoom: 1.1 },
          ]}
        >
          {STATS.map((r, i) => {
            const k = prog(t, STAT_AT[i], STAT_AT[i] + 0.4, EASE.land);
            if (k <= 0) return null;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: r.x,
                  top: r.y,
                  width: r.w,
                  height: r.h,
                  borderRadius: 12,
                  transform: `translateY(${-6 * k}px) scale(${1 + 0.07 * k})`,
                  boxShadow: `0 0 0 ${2.5 * Math.min(1, k)}px ${C.gold}, 0 ${10 * k}px ${22 * k}px rgba(70,48,25,${0.28 * Math.min(1, k)})`,
                  overflow: "hidden",
                }}
              >
                <Crop src={cap("results-0")} region={r} scale={1} />
              </div>
            );
          })}
        </PageCam>
      </div>
      <QuadLabel text="Behind the scenes: measured" at={LAND[3] - 0.05} />
    </AbsoluteFill>
  );
};

// ───────────── TR: print and play ─────────────
const QuadPrint: React.FC = () => {
  const t = useSec();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 90% at 70% 10%, #3a2c20 0%, ${C.night} 62%, #120d09 100%)` }}>
      <AbsoluteFill style={{ transform: `scale(${push(t)})`, transformOrigin: "50% 40%" }}>
        {LAYOUT["print-0"] ? <PrintScene /> : null}
      </AbsoluteFill>
      <QuadLabel text="Print and play" at={LAND[1] - 0.05} dark />
    </AbsoluteFill>
  );
};

/** How far quadrant i is out of its slot and in focus (0..1), and how dim it sits while another has it. */
const focusOf = (i: number, t: number) => {
  const grow = i === 0 ? 1 : prog(t, LAND[i] - MOVE, LAND[i], EASE.inOut);
  const end = i < 3 ? LAND[i + 1] : GRID;
  const shrink = 1 - prog(t, end - MOVE, end, EASE.inOut);
  return Math.min(grow, shrink);
};

export const Quad: React.FC = () => {
  const t = useSec();
  const scenes = [<QuadFriends key="tl" />, <QuadPrint key="tr" />, <QuadMochi key="bl" />, <QuadResults key="br" />];
  const together = prog(t, GRID - MOVE, GRID, EASE.inOut);
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
      {QUADS.map((q, i) => {
        const f = focusOf(i, t);
        const z = lerp(1, FOCUS.z, f);
        const dim = (1 - f) * (1 - together) * 0.62;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: lerp(q.x, FOCUS.x, f),
              top: lerp(q.y, FOCUS.y, f),
              width: QW * z,
              height: QH * z,
              borderRadius: 20,
              overflow: "hidden",
              zIndex: f > 0 ? 10 : 1,
              boxShadow: f > 0 ? `0 ${20 * f}px ${60 * f}px rgba(0,0,0,${0.5 * f})` : undefined,
            }}
          >
            {/* Layout-level zoom, so the stills and footage are drawn sharp at the larger size. */}
            <div style={{ position: "absolute", left: 0, top: 0, width: QW, height: QH, zoom: z }}>{scenes[i]}</div>
            {dim > 0.005 ? <div style={{ position: "absolute", inset: 0, background: `rgba(29,23,18,${dim})` }} /> : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
