// The quad's top right: the made game's print-and-play kit (rules, board and cards on A4), scrolled
// in three flicks of the wheel (a camera move over the real page; nothing is clicked). The page is the app's own kit,
// stitched from the five scroll positions the capture took (900 CSS px apart, then 366 to the end;
// public/shots/quad/print-tall.jpg, x 500-1420 of the page), with its toolbar pinned on top.
import React from "react";
import { Img, staticFile } from "remotion";
import { C, F, displaySoft, lift } from "../../lib/theme";
import { BEAT, EASE, prog, useSec } from "../../lib/time";
import { SpeedBlur } from "../paint/SpeedBlur";

const PAGE_W = 920; // CSS px of the stitched kit
const PAGE_H = 4146;
const BAR_H = 46; // the kit's toolbar
const WIN = { x: 288, y: 34, w: 600, h: 410 };
const K = WIN.w / PAGE_W;
const VIEW_H = WIN.h - BAR_H * K;

/** The three flicks: [start, end, from, to] in seconds and CSS px of scroll. */
const FLICKS: [number, number, number, number][] = [
  [2.3, 6 * BEAT, 0, 900],
  [3.0, 7.5 * BEAT, 900, 1800],
  [3.69, 9 * BEAT - 0.05, 1800, 3066],
];
const scrollAt = (t: number) => {
  let s = 0;
  for (const [a, b, from, to] of FLICKS) if (t >= a) s = from + (to - from) * prog(t, a, b, EASE.out);
  return s;
};

const Part: React.FC<{ text: string; at: number; y: number }> = ({ text, at, y }) => {
  const t = useSec();
  const k = prog(t, at, at + 0.35, EASE.land);
  return (
    <div
      style={{
        position: "absolute",
        left: 34,
        top: y,
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: F.display,
        ...displaySoft,
        fontWeight: 600,
        fontSize: 40,
        color: C.panel,
        opacity: Math.min(1, k * 2),
        transform: `translateX(${(1 - k) * -24}px)`,
      }}
    >
      <span style={{ width: 30, height: 30, borderRadius: 99, background: C.gold, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={18} height={18} viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={C.ink} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {text}
    </div>
  );
};

export const PrintScene: React.FC = () => {
  const t = useSec();
  const settle = prog(t, 0, 0.35, EASE.out); // on screen from the first frame, settling
  const s = scrollAt(t);
  const vy = (scrollAt(t + 1 / 60) - scrollAt(t - 1 / 60)) * K; // px per 30 fps frame, on screen
  return (
    <>
      <Part text="Rules" at={2.15} y={70} />
      <Part text="Board" at={6 * BEAT} y={130} />
      <Part text="Cards" at={7.5 * BEAT} y={190} />
      <div
        style={{
          position: "absolute",
          left: WIN.x,
          top: WIN.y,
          width: WIN.w,
          height: WIN.h,
          borderRadius: 14,
          overflow: "hidden",
          background: "#d2d2d2",
          ...lift(4),
          border: `1.5px solid ${C.panel}`,
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          transform: `translateY(${(1 - settle) * 24}px)`,
        }}
      >
        <div style={{ position: "absolute", left: 0, top: BAR_H * K, width: WIN.w, height: VIEW_H, overflow: "hidden" }}>
          <SpeedBlur vx={0} vy={vy} amount={0.18} max={10}>
            <Img
              src={staticFile("shots/quad/print-tall.jpg")}
              style={{ position: "absolute", left: 0, top: -(BAR_H + s) * K, width: PAGE_W * K, height: PAGE_H * K, maxWidth: "none" }}
            />
          </SpeedBlur>
        </div>
        <Img src={staticFile("shots/quad/print-toolbar.png")} style={{ position: "absolute", left: 0, top: 0, width: WIN.w, height: BAR_H * K, boxShadow: "0 2px 6px rgba(0,0,0,0.12)" }} />
      </div>
    </>
  );
};
