// Shot 2, bars 5–9 (9.23 s): the README's flow diagram (docs/media/two-ways.svg, made with the
// arch-diagram skill) redrawn on the film's clock with shotcraft draw-svg-trace grammar
// (demos/ui-entrance/draw-svg-trace/DrawSvgTrace.tsx): each box is traced by a pen with a visible
// head, flashes as the outline closes, then inks in its label. The old way is traced a beat a box and
// keeps looping (weeks); BoardDream's lane is traced on eighth notes and lands on bar 5 (minutes).
// The shot opens mid-draw (the old way nearly drawn), so its first frame has content; the diagram is
// drawn calmly, complete by 4.82 s, then the whole figure holds still and readable for 4.2 s (the
// gold dot racing BoardDream's lane), then the push into the next shot.
// Same layout, labels and colours as the README figure; type sizes raised one step for the film.
import React from "react";
import { AbsoluteFill } from "remotion";
import { F } from "../lib/theme";
import { EASE, lerp, prog, useSec } from "../lib/time";
import { Caption, Stage } from "../lib/ui";

// panel placement: the 1920 x 820 figure at 0.95
const S = 0.95;
const PX = (1920 - 1920 * S) / 2;
const PY = 178;

const OLD = { stroke: "#8a7d69", text: "#bfb19b", fill: "rgba(191,177,155,0.05)" };
const DREAM = { stroke: "#d9a441", text: "#f5ecdc", gold: "#f0cf86", fill: "rgba(217,164,65,0.08)" };

type Pt = [number, number];
type Rect = { x: number; y: number; w: number; h: number; rx: number };

/** Point at arc-length fraction u on a rounded rect, clockwise from (x + rx, y), as SVG draws <rect>. */
const rrPoint = (u: number, { x, y, w, h, rx: r }: Rect): Pt => {
  const sx = w - 2 * r;
  const sy = h - 2 * r;
  const arc = (Math.PI * r) / 2;
  const total = 2 * sx + 2 * sy + 4 * arc;
  let s = Math.min(Math.max(u, 0), 1) * total;
  const segs: [number, (k: number) => Pt][] = [
    [sx, (k) => [x + r + k * sx, y]],
    [arc, (k) => [x + w - r + r * Math.sin((k * Math.PI) / 2), y + r - r * Math.cos((k * Math.PI) / 2)]],
    [sy, (k) => [x + w, y + r + k * sy]],
    [arc, (k) => [x + w - r + r * Math.cos((k * Math.PI) / 2), y + h - r + r * Math.sin((k * Math.PI) / 2)]],
    [sx, (k) => [x + w - r - k * sx, y + h]],
    [arc, (k) => [x + r - r * Math.sin((k * Math.PI) / 2), y + h - r + r * Math.cos((k * Math.PI) / 2)]],
    [sy, (k) => [x, y + h - r - k * sy]],
    [arc, (k) => [x + r - r * Math.cos((k * Math.PI) / 2), y + r - r * Math.sin((k * Math.PI) / 2)]],
  ];
  for (const [len, f] of segs) {
    if (s <= len) return f(len > 0 ? s / len : 0);
    s -= len;
  }
  return [x + r, y];
};

/** The part of a polyline from its start to fraction p of its length. */
const partial = (pts: Pt[], p: number): Pt[] => {
  const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  let left = Math.min(Math.max(p, 0), 1) * total;
  const out: Pt[] = [pts[0]];
  for (let i = 0; i < lens.length; i++) {
    if (left >= lens[i]) {
      out.push(pts[i + 1]);
      left -= lens[i];
    } else {
      const k = lens[i] === 0 ? 0 : left / lens[i];
      out.push([lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)]);
      break;
    }
  }
  return out;
};

const pointAt = (pts: Pt[], p: number): Pt => {
  const q = partial(pts, p);
  return q[q.length - 1];
};

const d = (pts: Pt[]) => pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ");

/** A flow arrow drawn from its start, then dashed and flowing as in the README (10 10, period). */
const Arrow: React.FC<{ pts: Pt[]; a: number; b: number; t: number; color: string; period: number }> = ({ pts, a, b, t, color, period }) => {
  const p = prog(t, a, b, EASE.inOut);
  if (p <= 0) return null;
  const shown = partial(pts, p);
  const flow = -((Math.max(0, t - b) / period) * 20);
  const end = shown[shown.length - 1];
  const prev = shown.length > 1 ? shown[shown.length - 2] : pts[0];
  const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const head = prog(t, b - 0.04, b + 0.04, (x) => x);
  const rot = (x: number, y: number): Pt => [end[0] + x * Math.cos(ang) - y * Math.sin(ang), end[1] + x * Math.sin(ang) + y * Math.cos(ang)];
  return (
    <g>
      <path d={d(shown)} stroke={color} strokeWidth={2.4} fill="none" strokeDasharray="10 10" strokeDashoffset={flow} />
      {head > 0 ? <path d={d([rot(-8, -5.4), rot(0, 0), rot(-8, 5.4)])} stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={head} /> : null}
      {p < 1 ? <circle cx={end[0]} cy={end[1]} r={4.5} fill={color} /> : null}
    </g>
  );
};

/**
 * A box (or pill) traced by a pen: outline grows clockwise with a tapered head and a round nib,
 * flashes brighter and thicker as it closes, then its fill and label ink in.
 */
const Traced: React.FC<{
  r: Rect;
  a: number;
  b: number;
  t: number;
  stroke: string;
  fill: string;
  width: number;
  pop?: boolean;
  children?: React.ReactNode;
}> = ({ r, a, b, t, stroke, fill, width, pop, children }) => {
  const p = prog(t, a, b, EASE.inOut);
  if (p <= 0) return null;
  // closure flash (card: 2f up, 6f back), on a dark ground brighter rather than blacker
  const flash = t < b ? 0 : t < b + 0.067 ? (t - b) / 0.067 : 1 - prog(t, b + 0.067, b + 0.267, EASE.out);
  const sw = width + flash * 2.2;
  const col = flash > 0.5 ? "#fff3d6" : stroke;
  const ink = prog(t, b, b + 0.28, EASE.out);
  const s = pop ? 0.9 + 0.1 * prog(t, b - 0.05, b + 0.25, EASE.land) : 1;
  const [nx, ny] = rrPoint(p, r);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} fill="#120d0a" opacity={ink} />
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} fill={fill} opacity={ink} />
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} fill="none" stroke={col} strokeWidth={sw} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} strokeLinecap="round" />
      {p < 1
        ? [
            { len: 0.04, w: width + 1.6 },
            { len: 0.024, w: width + 2.6 },
            { len: 0.011, w: width + 3.6 },
          ].map(({ len, w }, k) => (
            <rect key={k} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} fill="none" stroke={stroke} strokeWidth={w} pathLength={1} strokeDasharray={`${len} ${1 - len}`} strokeDashoffset={len - p} strokeLinecap="round" />
          ))
        : null}
      {p < 1 ? <circle cx={nx} cy={ny} r={5.5} fill="#fff3d6" /> : null}
      <g opacity={ink} transform={`translate(0 ${(1 - ink) * 8})`} style={{ filter: ink < 1 ? `blur(${(1 - ink) * 4}px)` : undefined }}>
        {children}
      </g>
    </g>
  );
};

const LABEL = { fontFamily: F.ui, fontWeight: 500, fontSize: 31, letterSpacing: "-0.01em", textAnchor: "middle" as const };
const PILL = { fontFamily: F.ui, fontWeight: 650, fontSize: 25, letterSpacing: "0.14em", textAnchor: "middle" as const };
const NOTE = { fontFamily: F.display, fontStyle: "italic" as const, fontWeight: 400, fontSize: 34 };
const AFTER = { fontFamily: F.display, fontStyle: "italic" as const, fontWeight: 500, fontSize: 46, textAnchor: "middle" as const };
const EYEBROW = { fontFamily: F.ui, fontWeight: 600, fontSize: 26, letterSpacing: "0.22em" };

/** Two label lines centred in a box. */
const Two: React.FC<{ r: Rect; a: string; b: string; color: string }> = ({ r, a, b, color }) => (
  <>
    <text x={r.x + r.w / 2} y={r.y + 46} fill={color} {...LABEL}>
      {a}
    </text>
    <text x={r.x + r.w / 2} y={r.y + 84} fill={color} {...LABEL}>
      {b}
    </text>
  </>
);

const Pill: React.FC<{ r: Rect; label: string; color: string }> = ({ r, label, color }) => (
  <text x={r.x + r.w / 2} y={r.y + 43} fill={color} {...PILL}>
    {label}
  </text>
);

/** A dot riding a path at constant speed, for `dur` seconds per path, cycling through the list. */
const dotAt = (paths: Pt[][], t: number, start: number, dur: number): Pt | null => {
  if (t < start) return null;
  const i = Math.floor((t - start) / dur);
  const k = ((t - start) % dur) / dur;
  return pointAt(paths[i % paths.length], k);
};

// the README figure's geometry
const R = {
  idea: { x: 90, y: 146, w: 176, h: 68, rx: 34 },
  write: { x: 409, y: 126, w: 262, h: 108, rx: 14 },
  paper: { x: 814, y: 126, w: 208, h: 108, rx: 14 },
  wait: { x: 1164, y: 126, w: 248, h: 108, rx: 14 },
  play: { x: 1555, y: 146, w: 275, h: 68, rx: 34 },
  sentence: { x: 90, y: 496, w: 258, h: 68, rx: 34 },
  design: { x: 421, y: 476, w: 194, h: 108, rx: 14 },
  mech: { x: 688, y: 476, w: 221, h: 108, rx: 14 },
  code: { x: 983, y: 476, w: 235, h: 108, rx: 14 },
  bots: { x: 1291, y: 476, w: 208, h: 108, rx: 14 },
  tonight: { x: 1572, y: 496, w: 258, h: 68, rx: 34 },
  fix: { x: 1298, y: 668, w: 194, h: 108, rx: 14 },
};
const A = {
  o1: [[266, 180], [405, 180]] as Pt[],
  o2: [[671, 180], [810, 180]] as Pt[],
  o3: [[1022, 180], [1160, 180]] as Pt[],
  loop: [[1288, 234], [1288, 290], [540, 290], [540, 238]] as Pt[],
  o4: [[1412, 180], [1551, 180]] as Pt[],
  d1: [[348, 530], [417, 530]] as Pt[],
  d2: [[615, 530], [684, 530]] as Pt[],
  d3: [[909, 530], [979, 530]] as Pt[],
  d4: [[1218, 530], [1287, 530]] as Pt[],
  d5: [[1499, 530], [1568, 530]] as Pt[],
  down: [[1349, 584], [1349, 664]] as Pt[],
  up: [[1441, 668], [1441, 588]] as Pt[],
};

// the old way, quickly: its first boxes are already drawn when the shot opens
const OLDT = {
  idea: [-1.2, -0.9],
  o1: [-0.9, -0.8],
  write: [-0.3, 0.23], // first frame: the idea in, its next box being drawn
  o2: [0.23, 0.33],
  paper: [0.3, 0.4616], // beat 1
  o3: [0.4616, 0.56],
  wait: [0.56, 0.923], // beat 2
  loop: [0.923, 1.385], // beat 3: back round the loop
  o4: [1.15, 1.25],
  play: [1.2, 1.385],
  note: [1.1, 1.4],
  weeks: [1.385, 1.65],
} as const;
// the dream lane lands on beats from beat 5 (2.308 s) to beat 10 (4.615 s)
const Q = 0.46156;
const LAND = { sentence: 2.308, design: 2.308 + Q, mech: 2.308 + 2 * Q, code: 2.308 + 3 * Q, bots: 2.308 + 4 * Q, fix: 4.385, tonight: 4.615 };
const TR = 0.24; // a dream trace
const OUT_AT = 8.99;
const END = 9.23;

export const TwoWays: React.FC = () => {
  const t = useSec();
  const enter = prog(t, 0, 0.3, EASE.out);
  const dim = 1 - 0.45 * prog(t, 2.05, 2.35, EASE.inOut);
  const push = 1 + 0.015 * prog(t, 0.3, OUT_AT, (x) => x);
  const out = prog(t, OUT_AT, END, EASE.in);
  // the hand-over: an accelerating push into "ONE SENTENCE", the next shot's subject; the cut to
  // the real idea box lands on bar 6
  const focus: Pt = [PX + (R.sentence.x + R.sentence.w / 2) * S, PY + (R.sentence.y + R.sentence.h / 2) * S];
  const zoom = push * (1 + 0.9 * out);

  const oldDot = dotAt([A.o2, A.o3, A.loop], t, 1.5, 0.6);
  const dreamDot = dotAt([A.d1, A.d2, A.d3, A.d4, A.down, A.up, A.d5], t, 4.9, 0.25);

  return (
    <Stage>
      <Caption text="Making a new game takes weeks." at={-0.45} y={66} size={64} mark={["weeks"]} out={2.0} />
      <Caption text="BoardDream makes one in minutes." at={2.2} y={66} size={64} mark={["minutes"]} />
      <AbsoluteFill
        style={{
          transformOrigin: `${focus[0]}px ${focus[1]}px`,
          transform: `scale(${zoom})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: PX,
            top: PY,
            width: 1920 * S,
            height: 820 * S,
            borderRadius: 24 * S,
            overflow: "hidden",
            transform: `translateY(${(1 - enter) * 14}px) scale(${0.99 + 0.01 * enter})`,
            boxShadow: "0 4px 0 #2d2016, 0 26px 50px rgba(45,32,22,0.35)",
          }}
        >
          <svg width={1920 * S} height={820 * S} viewBox="0 0 1920 820">
            <defs>
              <pattern id="tw-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0H0V40" fill="none" stroke="#211912" strokeWidth={1} />
              </pattern>
            </defs>
            <rect x={0} y={0} width={1920} height={820} rx={24} fill="#120d0a" />
            <rect x={0} y={0} width={1920} height={820} rx={24} fill="url(#tw-grid)" />

            {/* THE OLD WAY: a box a beat, then round and round */}
            <g opacity={dim}>
              <text x={90} y={78} fill={OLD.stroke} {...EYEBROW}>
                THE OLD WAY
              </text>
              <Arrow pts={A.o1} a={OLDT.o1[0]} b={OLDT.o1[1]} t={t} color={OLD.stroke} period={2.4} />
              <Arrow pts={A.o2} a={OLDT.o2[0]} b={OLDT.o2[1]} t={t} color={OLD.stroke} period={2.4} />
              <Arrow pts={A.o3} a={OLDT.o3[0]} b={OLDT.o3[1]} t={t} color={OLD.stroke} period={2.4} />
              <Arrow pts={A.loop} a={OLDT.loop[0]} b={OLDT.loop[1]} t={t} color={OLD.stroke} period={2.4} />
              <Arrow pts={A.o4} a={OLDT.o4[0]} b={OLDT.o4[1]} t={t} color={OLD.stroke} period={2.4} />
              <Traced r={R.idea} a={OLDT.idea[0]} b={OLDT.idea[1]} t={t} stroke={OLD.stroke} fill={OLD.fill} width={2.5}>
                <Pill r={R.idea} label="AN IDEA" color={OLD.text} />
              </Traced>
              <Traced r={R.write} a={OLDT.write[0]} b={OLDT.write[1]} t={t} stroke={OLD.stroke} fill={OLD.fill} width={2}>
                <Two r={R.write} a="Write the rules" b="by hand" color={OLD.text} />
              </Traced>
              <Traced r={R.paper} a={OLDT.paper[0]} b={OLDT.paper[1]} t={t} stroke={OLD.stroke} fill={OLD.fill} width={2}>
                <Two r={R.paper} a="Cut a paper" b="prototype" color={OLD.text} />
              </Traced>
              <Traced r={R.wait} a={OLDT.wait[0]} b={OLDT.wait[1]} t={t} stroke={OLD.stroke} fill={OLD.fill} width={2}>
                <Two r={R.wait} a="Wait for a" b="playtest night" color={OLD.text} />
              </Traced>
              <Traced r={R.play} a={OLDT.play[0]} b={OLDT.play[1]} t={t} stroke={OLD.stroke} fill={OLD.fill} width={2.5}>
                <Pill r={R.play} label="FINALLY, PLAY" color={OLD.text} />
              </Traced>
              <text x={914} y={340} textAnchor="middle" fill={OLD.text} {...NOTE} opacity={prog(t, OLDT.note[0], OLDT.note[1])}>
                Not fun yet? Rewrite it, and wait a week.
              </text>
              <text x={1692.5} y={118} fill={OLD.text} {...AFTER} opacity={prog(t, OLDT.weeks[0], OLDT.weeks[1])} transform={`translate(0 ${(1 - prog(t, OLDT.weeks[0], OLDT.weeks[1])) * 12})`}>
                weeks later
              </text>
              {oldDot ? <circle cx={oldDot[0]} cy={oldDot[1]} r={7} fill="#d9ccb6" /> : null}
            </g>

            {/* WITH BOARDDREAM: straight through on eighth notes */}
            <g>
              <text x={90} y={428} fill={DREAM.stroke} {...EYEBROW} opacity={prog(t, 1.85, 2.1)}>
                WITH BOARDDREAM
              </text>
              <Arrow pts={A.d1} a={LAND.sentence} b={LAND.sentence + 0.15} t={t} color={DREAM.stroke} period={0.75} />
              <Arrow pts={A.d2} a={LAND.design} b={LAND.design + 0.15} t={t} color={DREAM.stroke} period={0.75} />
              <Arrow pts={A.d3} a={LAND.mech} b={LAND.mech + 0.15} t={t} color={DREAM.stroke} period={0.75} />
              <Arrow pts={A.d4} a={LAND.code} b={LAND.code + 0.15} t={t} color={DREAM.stroke} period={0.75} />
              <Arrow pts={A.down} a={LAND.bots} b={LAND.bots + 0.06} t={t} color={DREAM.stroke} period={0.75} />
              <Arrow pts={A.up} a={LAND.fix} b={LAND.fix + 0.06} t={t} color={DREAM.stroke} period={0.75} />
              <Arrow pts={A.d5} a={LAND.tonight - TR - 0.1} b={LAND.tonight - TR} t={t} color={DREAM.stroke} period={0.75} />
              <Traced r={R.sentence} a={LAND.sentence - TR} b={LAND.sentence} t={t} stroke={DREAM.stroke} fill={DREAM.fill} width={2.5} pop>
                <Pill r={R.sentence} label="ONE SENTENCE" color={DREAM.gold} />
              </Traced>
              <Traced r={R.design} a={LAND.design - TR} b={LAND.design} t={t} stroke={DREAM.stroke} fill={DREAM.fill} width={2} pop>
                <Two r={R.design} a="Muse Spark" b="designs it" color={DREAM.text} />
              </Traced>
              <Traced r={R.mech} a={LAND.mech - TR} b={LAND.mech} t={t} stroke={DREAM.stroke} fill={DREAM.fill} width={2} pop>
                <Two r={R.mech} a="Picks tested" b="mechanics" color={DREAM.text} />
              </Traced>
              <Traced r={R.code} a={LAND.code - TR} b={LAND.code} t={t} stroke={DREAM.stroke} fill={DREAM.fill} width={2} pop>
                <Two r={R.code} a="Writes the" b="rules as code" color={DREAM.text} />
              </Traced>
              <Traced r={R.bots} a={LAND.bots - TR} b={LAND.bots} t={t} stroke={DREAM.stroke} fill={DREAM.fill} width={2} pop>
                <Two r={R.bots} a="Bots play" b="1,000 games" color={DREAM.text} />
              </Traced>
              <Traced r={R.fix} a={LAND.fix - 0.18} b={LAND.fix} t={t} stroke={DREAM.stroke} fill={DREAM.fill} width={2} pop>
                <Two r={R.fix} a="Muse Spark" b="fixes it" color={DREAM.text} />
              </Traced>
              <Traced r={R.tonight} a={LAND.tonight - TR} b={LAND.tonight} t={t} stroke={DREAM.stroke} fill={DREAM.fill} width={2.5} pop>
                <Pill r={R.tonight} label="PLAY TONIGHT" color={DREAM.gold} />
              </Traced>
              <text x={1331} y={640} textAnchor="end" fill={DREAM.gold} {...NOTE} opacity={prog(t, LAND.fix - 0.05, LAND.fix + 0.2)}>
                if it breaks
              </text>
              <text x={1459} y={640} textAnchor="start" fill={DREAM.gold} {...NOTE} opacity={prog(t, LAND.fix - 0.05, LAND.fix + 0.2)}>
                test again
              </text>
              <text x={1701} y={468} fill={DREAM.gold} {...AFTER} opacity={prog(t, LAND.tonight, LAND.tonight + 0.2)} transform={`translate(0 ${(1 - prog(t, LAND.tonight, LAND.tonight + 0.2)) * 12})`}>
                minutes later
              </text>
              {dreamDot ? <circle cx={dreamDot[0]} cy={dreamDot[1]} r={7} fill={DREAM.gold} /> : null}
            </g>
          </svg>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
