// Shot 8, bars 32-35 (7.38 s; bar 32 the music falls away, 33-35 a calm breakdown): the made
// game's board painted by Muse Image and checked by SAM 3.1,
// all on real screen footage of Clovefire Reach (revised).
// 0-2.3 s: the real painting run (paint.mp4: "Paint the board" clicked at 0 s, done at about 34 s),
// played fast and labelled with its real time, the camera drifting toward the Art tab as the
// progress bar fills and SAM 3.1's result appears.
// 2.3-4.6 s: SAM 3.1's result in the Art tab at real speed, lifted out and held.
// 4.6-7.4 s, video-shotcraft before-after-slider-scrub (demos/data/before-after-slider-scrub/
// BeforeAfterSliderScrub.tsx): the same table before painting (table-mine.mp4) under the painted
// table (painted-table.mp4), one camera on both; the divider winds back, flings to 76 % on the beat,
// settles at 70 %, then scrubs slowly back (about a quarter of the fling's speed). SAM 3.1's result is
// lifted out of the Art tab exactly as the app shows it.
import React from "react";
import { AbsoluteFill, Img, Sequence, spring, staticFile } from "remotion";
import { C, F, lift } from "../lib/theme";
import { BEAT, EASE, prog, sf, useSec } from "../lib/time";
import { Caption, ModelChip, SpeedTag, Stage } from "../lib/ui";
import { type CamKey } from "../lib/PageCam";
import { SpeedBlur } from "./paint/SpeedBlur";
import { VideoCam } from "./paint/VideoCam";

// The footage window: 1680 x 945, 77 % of the frame.
const WIN = { x: 120, y: 96, w: 1680, h: 945 };
const W = WIN.w;
const H = WIN.h;

// ── Bar 21: the painting, real run sped up ──
const FAST = 5 * BEAT; // the run fills 0..FAST (2.3 s)
const B = 10 * BEAT; // the slider starts (4.6 s)
const END = 16 * BEAT; // the shot's length (7.38 s)
const RUN = 34.4; // seconds of the real run shown fast (done at about 34.1 s)
const RATE = RUN / FAST;
// The whole page first (the board and the Art tab), then in on the Art tab: its progress bar,
// then SAM 3.1's result where the app prints it.
const PAINT_KEYS: CamKey[] = [
  { t: 0, cx: 960, cy: 540, zoom: 0.875 },
  { t: 0.8, cx: 980, cy: 520, zoom: 0.93 },
  { t: 2.15, cx: 1426, cy: 330, zoom: 1.7 },
];
const DONE_KEYS: CamKey[] = [
  { t: 0, cx: 1426, cy: 330, zoom: 1.7 },
  { t: B - FAST, cx: 1426, cy: 324, zoom: 1.76 },
];

// ── Bar 22: before and after, one camera on both clips ──
const TABLE_KEYS: CamKey[] = [
  { t: 0, cx: 790, cy: 420, zoom: 1.33 },
  { t: END - B, cx: 790, cy: 410, zoom: 1.4 },
];
const BEFORE = { clip: "table-mine", from: 6.0 }; // the table before painting, my turn
const AFTER = { clip: "painted-table", from: 0.0 }; // the painted table

// The divider (percent of the window's width), in seconds of the shot.
// Calmer than the card's 5:1 for the breakdown: a 0.46 s fling against a 1.1 s scrub.
const REST = 4.9;
const T0 = 5.08;
const FLING = 12 * BEAT; // lands on beat 12
const BOUNCE = 5.85;
const HOLD = 6.0;
const SCRUB = 7.1;
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const posAt = (t: number): number => {
  if (t < T0) return mix(8, 6.5, prog(t, REST, T0, EASE.inOut));
  if (t < FLING) return mix(6.5, 76, prog(t, T0, FLING, EASE.out));
  if (t < BOUNCE) return mix(76, 70, prog(t, FLING, BOUNCE, EASE.inOut));
  if (t < HOLD) return 70;
  return mix(70, 48, prog(t, HOLD, SCRUB, EASE.inOut));
};
const REPORT_AT = 6 * BEAT; // SAM 3.1's result, lifted, lands on beat 6 and holds to the slider

const LayerTag: React.FC<{ left?: number; right?: number; children: React.ReactNode }> = ({ left, right, children }) => (
  <div style={{ position: "absolute", top: 24, left, right }}>{children}</div>
);
const chipStyle = { background: "rgba(251,243,225,0.94)", boxShadow: "0 4px 12px rgba(45,32,22,0.2)" };

export const Paint: React.FC = () => {
  const t = useSec();
  const inB = t >= B;
  const p = posAt(t);
  const x = (p / 100) * W;
  const vx = ((posAt(t + 1 / 60) - posAt(t - 1 / 60)) / 100) * W; // px per 30 fps frame
  const speed = Math.abs(vx);
  const squish = 1 + Math.min(speed / 110, 1) * 0.18;
  const press = 1 - 0.06 * Math.sin(Math.PI * prog(t, REST, FLING, (k) => k));
  const rep = t >= REPORT_AT && t < B ? spring({ frame: (t - REPORT_AT) * 30, fps: 30, config: { damping: 15, stiffness: 210 } }) : 0;
  const settle = prog(t, 0, 0.3, EASE.out);
  return (
    <Stage>
      <div
        style={{
          position: "absolute",
          left: WIN.x,
          top: WIN.y,
          width: W,
          height: H,
          borderRadius: 20,
          overflow: "hidden",
          background: C.panel,
          ...lift(5),
          transform: `scale(${0.985 + 0.015 * settle})`,
        }}
      >
        {/* Bar 21: Paint the board, the real run, fast. */}
        <Sequence durationInFrames={sf(FAST)} name="painting (real run, fast)">
          <VideoCam clip="paint" from={0} rate={RATE} keys={PAINT_KEYS} viewW={W} viewH={H} />
        </Sequence>
        <Sequence from={sf(FAST)} durationInFrames={sf(B) - sf(FAST)} name="painted, SAM 3.1's result">
          <VideoCam clip="paint" from={RUN} keys={DONE_KEYS} viewW={W} viewH={H} />
        </Sequence>
        {!inB ? (
          <>
            <SpeedTag text={t < FAST ? "Real run · 34 s → 2.3 s" : "Real run · done in 34 s"} x={24} y={24} at={-0.4} />
            <div style={{ position: "absolute", left: 24, top: 74 }}>
              <ModelChip name={t < FAST ? "Muse Image painting" : "Painted by Muse Image"} tone="gold" size={28} style={chipStyle} />
            </div>
          </>
        ) : null}

        {/* Bar 22: before and after, real footage under one camera. */}
        <Sequence from={sf(B)} name="before / after">
          <AbsoluteFill>
            <VideoCam clip={BEFORE.clip} from={BEFORE.from} keys={TABLE_KEYS} viewW={W} viewH={H} />
            <LayerTag right={24}>
              <ModelChip name="Before painting" tone="ink" size={28} style={chipStyle} />
            </LayerTag>
            <AbsoluteFill style={{ width: W, height: H, clipPath: `inset(0 ${Math.max(0, W - x)}px 0 0)` }}>
              <VideoCam clip={AFTER.clip} from={AFTER.from} keys={TABLE_KEYS} viewW={W} viewH={H} />
              <LayerTag left={24}>
                <ModelChip name="Painted by Muse Image" tone="gold" size={28} style={chipStyle} />
              </LayerTag>
            </AbsoluteFill>
          </AbsoluteFill>
        </Sequence>
        {inB ? (
          <div style={{ position: "absolute", inset: 0 }}>
            <SpeedBlur vx={vx} amount={0.12} max={14}>
              <div style={{ position: "absolute", left: x - 1.5, top: 0, width: 3, height: H, background: "#fffaef", boxShadow: "0 0 0 1px rgba(45,32,22,0.35), 0 0 24px rgba(45,32,22,0.3)" }} />
              <div
                style={{
                  position: "absolute",
                  left: x - 36,
                  top: H / 2 - 36,
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  background: "linear-gradient(180deg, #fffaef, #f3e7cf)",
                  border: `2px solid ${C.ink}`,
                  boxShadow: `0 3px 0 ${C.ink}, 0 ${12 + Math.min(speed / 8, 16)}px ${24 + Math.min(speed / 4, 20)}px rgba(70,48,25,0.3)`,
                  transform: `scale(${press * squish}, ${press})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
                }}
              >
                <svg width={34} height={20} viewBox="0 0 36 20">
                  <path d="M11 3 L4 10 L11 17" fill="none" stroke={C.ink} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M25 3 L32 10 L25 17" fill="none" stroke={C.ink} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </SpeedBlur>
          </div>
        ) : null}

        {/* SAM 3.1's result, exactly as the Art tab shows it (paint.mp4 at 40 s). */}
        {rep > 0 ? (
          <div
            style={{
              position: "absolute",
              left: 26,
              bottom: 128,
              padding: "12px 18px 10px",
              borderRadius: 14,
              background: C.panel,
              ...lift(4),
              transform: `translateY(${(1 - rep) * 40}px) scale(${0.85 + 0.15 * rep})`,
              transformOrigin: "0% 100%",
              opacity: Math.min(1, rep * 2),
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <ModelChip name="SAM 3.1" size={26} />
              <span style={{ fontFamily: F.ui, fontWeight: 600, fontSize: 24, color: C.muted }}>in the Art tab</span>
            </div>
            <div style={{ position: "relative", width: 520 * 1.35, height: 50 * 1.35, overflow: "hidden" }}>
              <Img src={staticFile("shots/paint/sam-report.png")} style={{ position: "absolute", left: 0, top: -138 * 1.35, width: 600 * 1.35, height: 192 * 1.35, maxWidth: "none" }} />
            </div>
          </div>
        ) : null}

        {/* A paper scrim under the caption. */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 170, background: "linear-gradient(180deg, rgba(251,243,225,0) 0%, rgba(251,243,225,0.86) 55%, rgba(251,243,225,0.94) 100%)" }} />
      </div>
      <Caption text="Muse Image paints the board." at={0.1} y={WIN.y + H - 92} size={60} mark={["Muse", "Image"]} out={FAST - 0.12} />
      <Caption text="SAM 3.1 checks every tile." at={FAST + 0.05} y={WIN.y + H - 92} size={60} mark={["SAM", "31"]} out={B - 0.12} />
      <Caption text="The same table, before and after." at={B + 0.25} y={WIN.y + H - 92} size={60} mark={["before", "after"]} />
    </Stage>
  );
};

/** Marks for the sound table (seconds in the shot). */
export const PAINT_CUES = { runStart: 0, done: FAST, report: REPORT_AT, slider: B, fling: T0, land: FLING, scrub: HOLD };
