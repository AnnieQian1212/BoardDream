// Shot 5 · Ready (bars 24–25, 3.69 s, the dip before the music comes back). Real screen recording at real
// speed (making-test.mp4 13.53–16.95 s): the "Your game is ready" panel with its real clock (8:37,
// Dream it up to ready) circled in gold, a push to the measured numbers and Start playing, the real
// pointer gliding in and clicking it (mouse down at 16.76 s in the clip) on beat 7. Then the camera
// crash-zooms into the button (crash-zoom-punch, the rebound kind: a 3% pull back, a 0.2 s ease-in
// push, a 4% rebound; motion blur only on the push) as the window opens to the full frame; the
// picture holds at 16.95 s, before the page turns to the table, which starts on bar 26.
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { camAt, type CamKey } from "../lib/PageCam";
import { C } from "../lib/theme";
import { BEAT, EASE, lerp, prog, useSec } from "../lib/time";
import { Caption, SpeedTag, Stage, Window } from "../lib/ui";
import { FootageCam, type Clip } from "./making/Footage";

const CLICK = 7 * BEAT; // 3.23 s
const CLIP: Clip = { name: "making-test", from: 16.76 - CLICK, rate: 1, freezeAt: 16.95 - (16.76 - CLICK) };
const BTN = { x: 122, y: 562 }; // Start playing, page CSS px
const CLOCK = { x: 206, y: 77 }; // the panel's clock
const PUSH0 = CLICK + 0.04;
const PUSH1 = PUSH0 + 0.2;
const END = 8 * BEAT;

const WIN0 = { x: 60, y: 88, w: 1800, h: 812 };
const WIN1 = { x: 0, y: 0, w: 1920, h: 1080 };

const KEYS: CamKey[] = [
  { t: 0, cx: 900, cy: 410, zoom: 1.0 },
  { t: 1.1, cx: 700, cy: 330, zoom: 1.3 },
  { t: 2.4, cx: 520, cy: 470, zoom: 1.75 },
  { t: CLICK - 0.18, cx: 500, cy: 490, zoom: 1.82 },
  { t: PUSH0, cx: 505, cy: 488, zoom: 1.77 },
];
const TARGET = { cx: 250, cy: 562, zoom: 4.0 };

export const Ready: React.FC = () => {
  const t = useSec();
  const enter = prog(t, 0, 0.45, EASE.out);

  const base = camAt(KEYS, Math.min(t, PUSH0));
  const push = interpolate(t, [PUSH0, PUSH1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.in });
  const rebound = interpolate(t, [PUSH1, PUSH1 + 0.17], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  const cam = {
    cx: lerp(base.cx, TARGET.cx, push),
    cy: lerp(base.cy, TARGET.cy, push),
    zoom: lerp(base.zoom, TARGET.zoom, push) * (1 - 0.04 * rebound),
  };
  const blur = t > PUSH0 && t < PUSH1 ? 4 * Math.sin(Math.PI * push) : 0;
  const win = { x: lerp(WIN0.x, WIN1.x, push), y: lerp(WIN0.y, WIN1.y, push), w: lerp(WIN0.w, WIN1.w, push), h: lerp(WIN0.h, WIN1.h, push) };
  const ring = prog(t, 0.55, 1.05, EASE.inOut);

  return (
    <Stage>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${(1 - enter) * 34}px)` }}>
        <Window x={win.x} y={win.y} w={win.w} h={win.h} radius={lerp(20, 0, push)} style={{ filter: blur > 0.05 ? `blur(${blur}px)` : undefined }}>
          <FootageCam clip={CLIP} keys={KEYS} cam={cam} viewW={win.w} viewH={win.h}>
            {/* The real clock, circled. */}
            <svg width={80} height={44} viewBox="0 0 80 44" style={{ position: "absolute", left: CLOCK.x - 40, top: CLOCK.y - 22, overflow: "visible" }}>
              <ellipse cx={40} cy={22} rx={34} ry={17} fill="none" stroke={C.gold} strokeWidth={2.6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ring} transform="rotate(-8 40 22)" />
            </svg>
            {/* The click: two gold rings, kept screen-sized. */}
            {[0, 1].map((r) => {
              const start = CLICK + r * 0.1;
              if (t < start || t > start + 0.34) return null;
              const k = prog(t, start, start + 0.34, EASE.out);
              const rad = (14 + ((r === 0 ? 54 : 78) - 14) * k) / cam.zoom;
              return <div key={r} style={{ position: "absolute", left: BTN.x - rad, top: BTN.y - rad, width: 2 * rad, height: 2 * rad, borderRadius: "50%", border: `${(r === 0 ? 3 : 2) / cam.zoom}px solid ${C.gold}`, opacity: 1 - k }} />;
            })}
          </FootageCam>
        </Window>
      </div>

      {/* A warm flash as the push lands, fading into the cut. */}
      <AbsoluteFill style={{ background: "#fff6e0", opacity: interpolate(t, [PUSH1 - 0.03, PUSH1, END], [0, 0.35, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />

      <SpeedTag text="Real recording · real time" x={1500} y={34} at={0} />
      <Caption text="Tested and ready to play in 8:37." at={BEAT + 0.05} y={918} size={66} mark={["837"]} out={CLICK + 0.02} />
    </Stage>
  );
};
