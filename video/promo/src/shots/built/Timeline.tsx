// Part (a), shotcraft `timeline-travel` (demos/data/timeline-travel/TimelineTravel.tsx): the camera,
// held close (1.6x), travels along the hackathon's ten days, slow start, sprint, hard brake on Nov 4;
// then, instead of the card's push in, it pulls back to the whole timeline, Oct 26 to Nov 4, every
// day's commits, date and one big thing readable at once, and holds there (3.7 s): that full view is
// the evidence of what was built when, so it is the arrival.
// Kept from the card: the [0,.15,.88,1]->[0,.055,.9,1] travel curve, minor ticks as the speed
// reference, each bar springing up (damping 11, a clear overshoot) a moment before the playhead
// reaches it, motion blur only while travelling, a still hold at the end.
// From the first frame: the title, the commit counter and the first days' bars are on screen.
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring } from "remotion";
import { C, F, displaySoft } from "../../lib/theme";
import { Caption, Stage } from "../../lib/ui";
import { DAYS, PEAK } from "./commits";
import { BEAT } from "../../lib/time";
import { EZ, SpeedBlur, alpha, mix, ramp } from "./fx";

// The full view (zoom 1): world coordinates are screen coordinates.
const X0 = 150;
const STEP = 180;
const dayX = (i: number) => X0 + i * STEP;
const AXIS_Y = 760;
const BAR_W = 92;
const BAR_MAX = 255;
const ROW_A = 836; // labels of even days
const ROW_B = 884; // labels of odd days

// The close travel.
const Z = 1.6;
const PLAYHEAD_X = 1100; // screen x where a day is reached during the travel
const FX0 = dayX(0) - (300 - 960) / Z; // Oct 26 starts at screen x 300
const FX1 = dayX(DAYS.length - 1) - (PLAYHEAD_X - 960) / Z; // Nov 4 at the playhead
const FY = 606; // world y at the frame's centre while close: bars' counts to the labels' rows fit under the header
const T0 = 0;
const T1 = 10 * BEAT; // hard brake, on a beat (4.62 s): a slow, readable travel for the calm breakdown
const PULL_END = 12 * BEAT; // pulled back on a beat (5.54 s); all ten days still until the end (9.23 s)

const travel = (t: number) => {
  const u = interpolate(t, [T0, T1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return interpolate(u, [0, 0.15, 0.88, 1], [0, 0.055, 0.9, 1], { easing: Easing.inOut(Easing.quad) });
};

const camAt = (t: number) => {
  const fxT = mix(FX0, FX1, travel(t));
  const p = ramp(t, T1, PULL_END - T1, EZ.smooth);
  return { fx: mix(fxT, 960, p), fy: mix(FY, 540, p), z: mix(Z, 1, p) };
};
const screenX = (wx: number, t: number) => {
  const c = camAt(t);
  return (wx - c.fx) * c.z + 960;
};

/** When each day reaches the playhead, minus the card's lead; the first days are already up (or rising) at the cut. */
const POP = DAYS.map((_, i) => {
  let at = T1;
  for (let t = 0; t <= T1 + 0.001; t += 1 / 120)
    if (screenX(dayX(i), t) <= PLAYHEAD_X) {
      at = t;
      break;
    }
  if (at === 0) return [-0.6, -0.42, -0.14][i] ?? 0;
  return at - 0.1;
});

const barH = (n: number) => 20 + (BAR_MAX - 20) * (n / PEAK);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const DayStop: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const day = DAYS[i];
  const hero = i === DAYS.length - 1;
  const x = dayX(i);
  const pop = POP[i];
  const s = spring({ frame: (t - pop) * 30, fps: 30, config: { damping: 11, stiffness: 160, mass: 0.9 }, durationInFrames: 26 });
  const on = t >= pop;
  const lit = interpolate(t, [pop, pop + 0.2], [0, 1], clamp);
  const h = barH(day.n);
  const label = interpolate(t, [pop + 0.06, pop + 0.34], [0, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const barColor = hero ? C.gold : C.accent;
  const rowY = i % 2 === 0 ? ROW_A : ROW_B;
  return (
    <div style={{ position: "absolute", left: x, top: 0 }}>
      <div style={{ position: "absolute", left: -15, top: AXIS_Y - 15, width: 30, height: 30, borderRadius: 15, background: alpha(hero ? C.gold : C.ink, 0.12), transform: `scale(${0.6 + 0.4 * lit})` }} />
      <div style={{ position: "absolute", left: -8, top: AXIS_Y - 8, width: 16, height: 16, borderRadius: 8, boxSizing: "border-box", border: `3px solid ${hero ? C.goldDeep : C.ink}`, background: lit > 0.5 ? (hero ? C.gold : C.ink) : C.paper }} />
      <div style={{ position: "absolute", left: -90, top: AXIS_Y + 22, width: 180, textAlign: "center", fontFamily: F.ui, fontWeight: 700, fontSize: 32, color: hero ? C.goldDeep : C.ink, opacity: 0.5 + 0.5 * lit }}>{day.d}</div>
      {on && (
        <>
          <div
            style={{
              position: "absolute",
              left: -BAR_W / 2,
              top: AXIS_Y - 14 - h,
              width: BAR_W,
              height: h,
              borderRadius: "12px 12px 4px 4px",
              background: `linear-gradient(180deg, ${barColor} 0%, ${alpha(barColor, 0.78)} 100%)`,
              border: `1.5px solid ${C.ink}`,
              boxShadow: `0 3px 0 ${C.ink}`,
              transform: `scaleY(${s})`,
              transformOrigin: "50% 100%",
            }}
          />
          <div style={{ position: "absolute", left: -90, top: AXIS_Y - 14 - h * Math.min(1.08, s) - 50, width: 180, textAlign: "center", fontFamily: F.ui, fontWeight: 800, fontSize: 38, color: C.ink, fontVariantNumeric: "tabular-nums", opacity: Math.min(1, s * 2) }}>
            {day.n}
          </div>
          {/* the day's one big thing, under its date, rows staggered so all ten fit */}
          {rowY === ROW_B ? <div style={{ position: "absolute", left: -0.75, top: AXIS_Y + 64, width: 1.5, height: ROW_B - AXIS_Y - 62, background: alpha(C.ink, 0.22 * label) }} /> : null}
          <div
            style={{
              position: "absolute",
              left: -175,
              top: rowY,
              width: 350,
              textAlign: "center",
              fontFamily: F.display,
              ...displaySoft,
              fontWeight: 600,
              fontSize: 33,
              lineHeight: 1.1,
              color: hero ? C.goldDeep : C.ink,
              opacity: label,
              transform: `translateY(${(1 - label) * 14}px)`,
              filter: `blur(${(1 - label) * 8}px)`,
              whiteSpace: "nowrap",
            }}
          >
            {day.label}
          </div>
        </>
      )}
    </div>
  );
};

export const Timeline: React.FC<{ t: number }> = ({ t }) => {
  const c = camAt(t);
  const vx = -(camAt(t + 1 / 60).fx - camAt(t - 1 / 60).fx) * c.z * 15; // screen px per 1/30 s
  const moving = t < T1 ? vx : 0; // blur only in the travel, never in the pull back
  const passed = DAYS.reduce((sum, d, i) => sum + d.n * interpolate(t, [POP[i], POP[i] + 0.3], [0, 1], clamp), 0);
  const count = Math.round(passed);
  const worldW = 1920;
  return (
    <AbsoluteFill>
      <Stage>
        <SpeedBlur vx={moving} amount={0.08} max={5}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: worldW,
              height: 1080,
              transformOrigin: "0 0",
              transform: `translate(${960 - c.fx * c.z}px, ${540 - c.fy * c.z}px) scale(${c.z})`,
            }}
          >
            <div style={{ position: "absolute", left: -400, top: AXIS_Y - 1.5, width: worldW + 800, height: 3, background: `linear-gradient(90deg, ${alpha(C.ink, 0)} 0%, ${alpha(C.ink, 0.35)} 12%, ${alpha(C.ink, 0.35)} 88%, ${alpha(C.ink, 0)} 100%)` }} />
            {Array.from({ length: DAYS.length * 4 + 4 }).map((_, k) =>
              k % 4 === 0 ? null : <div key={k} style={{ position: "absolute", left: dayX(0) - STEP + (k * STEP) / 4 - 1, top: AXIS_Y - 8, width: 2, height: 16, borderRadius: 1, background: alpha(C.ink, 0.22) }} />,
            )}
            {DAYS.map((_, i) => (
              <DayStop key={i} i={i} t={t} />
            ))}
          </div>
        </SpeedBlur>
        {/* header: on screen, landed, from the first frame */}
        <Caption text="Built in 10 days at the Meta AI Developer Hackathon" at={-1} x={120} y={118} align="left" width={1700} size={60} mark={["10", "days"]} stagger={0.035} />
        <div style={{ position: "absolute", left: 122, top: 204, fontFamily: F.ui, fontWeight: 600, fontSize: 40, color: C.muted }}>
          <span style={{ color: C.accentStrong, fontWeight: 800, fontVariantNumeric: "tabular-nums", display: "inline-block", minWidth: 78, textAlign: "right" }}>{count}</span> commits, all in the public log on GitHub
        </div>
      </Stage>
    </AbsoluteFill>
  );
};

export const TIMELINE_POP = POP;
