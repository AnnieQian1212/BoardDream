// House rules (bars 29–31, 5.54 s): a house rule in plain words, on real screen footage of Clovefire Reach.
// The app window stays where the table shot left it (same geometry, its push easing back); the
// Designer drawer's "Change the rules" panel is lifted out as a loupe: a magnified live view of that
// part of the page, laid over the drawer itself, so nothing on screen is shown twice.
//   0.00–1.89  rule.mp4 from 7.23 s, real speed: the last of "Every family starts the game with one
//              extra lamp-oil." typed, the rule held, the cursor clicks Apply the change on beat 4
//              (9.08 s in the clip).
//   1.89–2.87  revise.mp4 0–10.3 s at 10.5× (the clip is already 8×: 82 of the 84 real seconds):
//              Muse Spark rewriting and re-testing the rules, its progress bar. Labelled.
//   2.77–5.54  revised.mp4 from 2.1 s, real speed: version two, a new Starting Lamp-oil dial and the
//              before/after of the replayed games, in the loupe only, held 2.6 s.
import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile } from "remotion";
import { C, F, displaySoft, lift } from "../lib/theme";
import { BEAT, EASE, lerp, prog, sf, useSec } from "../lib/time";
import { Caption, ModelChip, Stage } from "../lib/ui";
import { ClockPill, END_PUSH, LowerThird, WIN_H, WIN_LEFT, WIN_R, WIN_S, WIN_TOP, WIN_W } from "./table/parts";

const CLICK = 4 * BEAT; // Apply the change, on beat 4
const B_AT = CLICK + 0.04; // the rewrite, sped up
const C_AT = 6 * BEAT; // version two, on beat 6
const XFADE = 0.1;

const RULE_FROM = Math.round((9.08 - CLICK) * 60); // rule.mp4: the click lands on beat 2
const REVISE_RATE = 10.3 / (C_AT + XFADE - B_AT); // revise.mp4 0 → 10.3 s (a page reload follows at 10.45 s)
const REVISED_FROM = Math.round(2.1 * 60); // revised.mp4: the table has settled after the reload

/** The loupe: the drawer's panel magnified 2.5×, 640 × 600 on screen, right-aligned to the drawer. */
const MAG = 2.5;
const LOUPE = { x: 1142, y: 163, w: 640, h: 600 };
const LX = 1786; // the drawer's centre, CSS px
const CY_RULE = 442; // "Change the rules", the typed rule, Apply, the progress bar
const CY_DONE = 425; // the new Starting Lamp-oil dial, the quote, Before / After

/** The three clips in order, placed so that page point (0, 0) is at (ox, oy) and 1 CSS px = m px. */
const Clips: React.FC<{ m: number; ox: number; oy: number }> = ({ m, ox, oy }) => {
  const t = useSec();
  const style = { position: "absolute" as const, left: ox, top: oy, width: 1920 * m, height: 1080 * m };
  return (
    <>
      <Sequence durationInFrames={sf(B_AT + 0.05)} layout="none">
        <OffthreadVideo src={staticFile("footage/clips/rule.mp4")} muted trimBefore={RULE_FROM} style={style} />
      </Sequence>
      <Sequence from={sf(B_AT)} durationInFrames={sf(C_AT + XFADE) - sf(B_AT)} layout="none">
        <OffthreadVideo src={staticFile("footage/clips/revise.mp4")} muted playbackRate={REVISE_RATE} style={style} />
      </Sequence>
      <Sequence from={sf(C_AT)} layout="none">
        <OffthreadVideo src={staticFile("footage/clips/revised.mp4")} muted trimBefore={REVISED_FROM} style={{ ...style, opacity: prog(t, C_AT, C_AT + XFADE, EASE.inOut) }} />
      </Sequence>
    </>
  );
};

export const HouseRule: React.FC = () => {
  const t = useSec();
  // The window, still where the drop left it, its push easing back.
  const push = lerp(END_PUSH, 1, prog(t, 0, 0.6, EASE.inOut));

  // The loupe grows out of the drawer's own footprint.
  const k = prog(t, 0.1, 0.5, EASE.land);
  const kOut = prog(t, 0.1, 0.5, EASE.out);
  const cy = lerp(CY_RULE, CY_DONE, prog(t, C_AT, C_AT + 0.45, EASE.cam));
  const m = lerp(WIN_S, MAG, k);
  const foot = {
    x: WIN_LEFT + (LX - LOUPE.w / MAG / 2) * WIN_S,
    y: WIN_TOP + (CY_RULE - LOUPE.h / MAG / 2) * WIN_S,
    w: (LOUPE.w / MAG) * WIN_S,
    h: (LOUPE.h / MAG) * WIN_S,
  };
  const lx = lerp(foot.x, LOUPE.x, k);
  const ly = lerp(foot.y, LOUPE.y, k);
  const lw = lerp(foot.w, LOUPE.w, k);
  const lh = lerp(foot.h, LOUPE.h, k);

  // The caption card grows a line at a time, so it never shows an empty band.
  const cardH = 104 + 74 * prog(t, CLICK, CLICK + 0.3, EASE.out) + 84 * prog(t, C_AT - 0.04, C_AT + 0.26, EASE.out);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Stage />

      <div
        style={{
          position: "absolute",
          left: WIN_LEFT,
          top: WIN_TOP,
          width: WIN_W,
          height: WIN_H,
          borderRadius: WIN_R,
          overflow: "hidden",
          background: C.panel,
          border: `1.5px solid ${C.ink}`,
          boxSizing: "border-box",
          boxShadow: `0 4px 0 ${C.ink}, 0 ${30 * WIN_S}px ${80 * WIN_S}px rgba(70, 48, 25, 0.28)`,
          transform: `scale(${push})`,
          transformOrigin: "50% 50%",
        }}
      >
        <Clips m={WIN_S} ox={0} oy={0} />
      </div>

      {/* The loupe over the drawer: the same footage, 2.5× (the drawer's text is 10 px in the page). */}
      <div
        style={{
          position: "absolute",
          left: lx,
          top: ly,
          width: lw,
          height: lh,
          borderRadius: 20 * k + 4,
          overflow: "hidden",
          background: C.panel,
          ...lift(4),
          boxShadow: `0 ${4 * kOut}px 0 ${C.ink}, 0 ${12 + 30 * kOut}px ${24 + 60 * kOut}px rgba(70, 48, 25, ${0.12 + 0.22 * kOut})`,
          opacity: prog(t, 0.08, 0.16),
        }}
      >
        <Clips m={m} ox={lw / 2 - LX * m} oy={lh / 2 - cy * m} />
      </div>

      {/* What the footage's clock is, above the loupe. */}
      <ClockPill text="Live · real speed" live x={LOUPE.x} y={LOUPE.y - 62} at={0.3} out={B_AT - 0.04} />
      <ClockPill text="Real run · 84 s → 1 s" x={LOUPE.x} y={LOUPE.y - 62} at={B_AT} out={C_AT - 0.02} />
      <ClockPill text="Live · real speed" live x={LOUPE.x} y={LOUPE.y - 62} at={C_AT + 0.02} />

      <LowerThird x={96} y={752} w={900} h={cardH} at={0.06}>
        <Caption text="House rules, in plain words." at={0.12} x={30} y={20} align="left" width={860} size={58} mark={["plain", "words"]} />
        <RewriteLine at={CLICK + 0.06} />
        <Caption text="Version 2, tested again." at={C_AT + 0.04} x={30} y={176} align="left" width={860} size={54} mark={["tested"]} />
      </LowerThird>
    </AbsoluteFill>
  );
};

/** Who rewrites the rules, named while it happens. */
const RewriteLine: React.FC<{ at: number }> = ({ at }) => {
  const t = useSec();
  const k = prog(t, at, at + 0.35, EASE.land);
  const o = prog(t, at, at + 0.15);
  if (o <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 30, top: 104, display: "flex", alignItems: "center", gap: 14, whiteSpace: "nowrap", opacity: o, transform: `translateY(${(1 - k) * 18}px)` }}>
      <ModelChip name="Muse Spark" size={32} />
      <span style={{ fontFamily: F.display, ...displaySoft, fontWeight: 600, fontSize: 44, color: C.ink, letterSpacing: "-0.01em" }}>rewrites the rules</span>
    </div>
  );
};
