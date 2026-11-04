// Shot 4 · The making (bars 17–23, 12.92 s, DROP ONE: full energy). Real screen recording of one
// run, "Clovefire Reach", 8:37 from Dream it up to ready, shown as a time-lapse labelled with the
// real speed, one phase at a time:
//   0.00–3.69  making-plan.mp4 (already 8×) 4–15 s at 3×: Muse Spark designs the game          → 24×
//   3.69–5.08  making-code.mp4 (already 16×) 0–20.5 s: Muse Spark planning the rules            → 237×
//   5.08–9.23  making-code.mp4 20.5–24.05 s: the rules streaming in as code (a live model call) → 14×
//   9.23–12.92 making-test.mp4 (real time) 2.5–11.2 s at 2.4×: bots play the draft 1,130 times  → 2.4×
// The code and the grid of test games are lifted out of the making panel as larger cards and held:
// the same recording, cropped (document-typewriter-reveal's lift: the card rises from where the part
// sits and turns square-on as it settles), so every number on screen is the app's own.
import React from "react";
import { Sequence } from "remotion";
import { camAt, type CamKey } from "../lib/PageCam";
import { EASE, BEAT, lerp, prog, sf, useSec } from "../lib/time";
import { Caption, SpeedTag, Stage, Window } from "../lib/ui";
import { FootageCam, FootageCrop, type Clip } from "./making/Footage";

const WIN = { x: 60, y: 88, w: 1800, h: 812 };
const F = { p: 0, c1: sf(8 * BEAT), c2: sf(11 * BEAT), t: sf(20 * BEAT), end: sf(28 * BEAT) };
const secs = (a: number, b: number) => (b - a) / 60;

const PLAN: Clip = { name: "making-plan", from: 4.0, rate: (15.0 - 4.0) / secs(F.p, F.c1) };
const CODE1: Clip = { name: "making-code", from: 0, rate: 20.5 / secs(F.c1, F.c2) };
const CODE2: Clip = { name: "making-code", from: 20.5, rate: (24.05 - 20.5) / secs(F.c2, F.t) };
const TEST: Clip = { name: "making-test", from: 2.5, rate: (11.2 - 2.5) / secs(F.t, F.end) };

/** The real speed of each stretch (making-plan is recorded 8× faster, making-code 16×). */
const SPEEDS = [
  { until: F.c1, x: 8 * PLAN.rate },
  { until: F.c2, x: 16 * CODE1.rate },
  { until: F.t, x: 16 * CODE2.rate },
  { until: Infinity, x: TEST.rate },
];
const fmt = (x: number) => (x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`);

// Framed from the page's left edge, so the making panel (the steps, the clock) stays whole.
const PLAN_KEYS: CamKey[] = [
  { t: 0, cx: 900, cy: 410, zoom: 1.0 },
  { t: secs(F.p, F.c1), cx: 860, cy: 405, zoom: 1.06 },
];
const CODE_KEYS: CamKey[] = [
  { t: 0, cx: 860, cy: 405, zoom: 1.06 },
  { t: 1.3, cx: 800, cy: 410, zoom: 1.14 },
  { t: secs(F.c1, F.t), cx: 790, cy: 412, zoom: 1.16 },
];
const TEST_KEYS: CamKey[] = [
  { t: 0, cx: 900, cy: 415, zoom: 1.0 },
  { t: secs(F.t, F.end), cx: 860, cy: 410, zoom: 1.06 },
];
const shift = (keys: CamKey[], dt: number) => keys.map((k) => ({ ...k, t: k.t - dt }));

// The parts lifted out of the making panel (page CSS px, read off the recordings).
const CODE_RECT = { x: 16, y: 336, w: 210, h: 144 }; // "Write the rules · Muse Spark · N lines so far" and the code
const TEST_RECT = { x: 16, y: 396, w: 210, h: 124 }; // "Playtest", the grid of games, "N of 1,130 games"
const CARD_ZOOM = 3.0;

/**
 * A part of the window's recording lifted out as a card: it starts exactly over the part (same
 * size, same place) and rises to `to`, square-on, at CARD_ZOOM.
 */
const Lifted: React.FC<{ clip: Clip; rect: typeof CODE_RECT; keys: CamKey[]; at: number; to: { x: number; y: number }; t0?: number }> = ({ clip, rect, keys, at, to, t0 = 0 }) => {
  const own = useSec();
  const t = own + t0; // the parent's clock
  if (t < at) return null;
  const k = prog(t, at, at + 0.5, EASE.out);
  const cam = camAt(keys, own);
  const src = { x: WIN.x + WIN.w / 2 + (rect.x - cam.cx) * cam.zoom, y: WIN.y + WIN.h / 2 + (rect.y - cam.cy) * cam.zoom };
  const scale = lerp(cam.zoom / CARD_ZOOM, 1, k);
  const x = lerp(src.x, to.x, k);
  const y = lerp(src.y, to.y, k);
  const w = rect.w * CARD_ZOOM;
  const h = rect.h * CARD_ZOOM;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, perspective: 1800 }}>
      <div style={{ position: "absolute", left: x, top: y, transformOrigin: "0 0", transform: `scale(${scale}) rotateY(${(1 - k) * -10}deg)` }}>
        <Window x={0} y={0} w={w} h={h} radius={14} depth={lerp(0, 5, k)} style={{ background: "#fbf3e1" }}>
          <FootageCrop clip={clip} rect={rect} zoom={CARD_ZOOM} />
        </Window>
      </div>
    </div>
  );
};

export const Making: React.FC = () => {
  const t = useSec();
  const frame = Math.round(t * 60);
  const speed = SPEEDS.find((s) => frame < s.until)!.x;
  const enter = prog(t, 0, 0.35, EASE.out);
  const cLocal = (F.c2 - F.c1) / 60;

  return (
    <Stage>
      {/* Drop one lands on the first frame: the window settles from 6% larger (one of the film's few whole-frame hits). */}
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + 0.06 * (1 - enter)})`, transformOrigin: "50% 48%" }}>
        <Window x={WIN.x} y={WIN.y} w={WIN.w} h={WIN.h} radius={20}>
          <Sequence from={F.p} durationInFrames={F.c1 - F.p} layout="none" name="plan">
            <FootageCam clip={PLAN} keys={PLAN_KEYS} viewW={WIN.w} viewH={WIN.h} />
          </Sequence>
          <Sequence from={F.c1} durationInFrames={F.c2 - F.c1} layout="none" name="code: planning">
            <FootageCam clip={CODE1} keys={CODE_KEYS} viewW={WIN.w} viewH={WIN.h} />
          </Sequence>
          <Sequence from={F.c2} durationInFrames={F.t - F.c2} layout="none" name="code: streaming">
            <FootageCam clip={CODE2} keys={shift(CODE_KEYS, cLocal)} viewW={WIN.w} viewH={WIN.h} />
          </Sequence>
          <Sequence from={F.t} durationInFrames={F.end - F.t} layout="none" name="playtest">
            <FootageCam clip={TEST} keys={TEST_KEYS} viewW={WIN.w} viewH={WIN.h} />
          </Sequence>
        </Window>
      </div>

      {/* The code, lifted out while Muse Spark writes it. */}
      <Sequence from={F.c1} durationInFrames={F.c2 - F.c1} layout="none">
        <Lifted clip={CODE1} rect={CODE_RECT} keys={CODE_KEYS} at={0.9} to={{ x: 1150, y: 300 }} />
      </Sequence>
      <Sequence from={F.c2} durationInFrames={F.t - F.c2} layout="none">
        <Lifted clip={CODE2} rect={CODE_RECT} keys={shift(CODE_KEYS, cLocal)} at={0.9} to={{ x: 1150, y: 300 }} t0={cLocal} />
      </Sequence>
      {/* The grid of test games, lifted out as the bots play. */}
      <Sequence from={F.t} durationInFrames={F.end - F.t} layout="none">
        <Lifted clip={TEST} rect={TEST_RECT} keys={TEST_KEYS} at={0.45} to={{ x: 1150, y: 330 }} />
      </Sequence>

      <SpeedTag text={`Real run · 8:37 of making · ${fmt(speed)} speed`} x={1240} y={34} at={0} />

      <Sequence from={F.p} durationInFrames={F.c1 - F.p} layout="none">
        <Caption text="Muse Spark designs it from tested mechanics." at={0.15} y={918} size={62} mark={["Muse", "Spark"]} out={secs(F.p, F.c1) - 0.3} />
      </Sequence>
      <Sequence from={F.c1} durationInFrames={F.t - F.c1} layout="none">
        <Caption text="Then Muse Spark writes the rules as code, live." at={0.15} y={918} size={62} mark={["code"]} out={secs(F.c1, F.t) - 0.3} />
      </Sequence>
      <Sequence from={F.t} durationInFrames={F.end - F.t} layout="none">
        <Caption text="Bots play it 1,130 times before you do." at={0.15} y={918} size={62} mark={["1130"]} />
      </Sequence>
    </Stage>
  );
};
