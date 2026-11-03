import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { MochiArt } from "./MochiArt";
import { C, DISPLAY, WIDTH } from "./theme";

/**
 * The guide: a mochi from the steamer game that hops to whatever the viewer should look at, the
 * way a mascot leads the eye in a hand-made animation. It lands on a spot, squashes, breathes, and
 * now and then says what is happening there in a sticker-style bubble.
 */
export interface Stop {
  /** When it lands here, in seconds from the start of its sequence. */
  at: number;
  /** Where its feet land, in frame pixels. */
  x: number;
  y: number;
  /** What it says once it has landed. */
  say?: string;
  /** Seconds the bubble stays; until the next hop when left out. */
  sayFor?: number;
  /** A happy face while it stands here. */
  happy?: boolean;
}

const HOP = 0.55;
const smooth = Easing.bezier(0.45, 0, 0.55, 1);

export const MochiGuide: React.FC<{ stops: Stop[]; friend?: number; size?: number; enter?: [number, number] }> = ({ stops, friend = 2, size = 128, enter }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // The landing it is heading for, and where it came from.
  const next = stops.findIndex((s) => t < s.at);
  const resting = next === -1 ? stops[stops.length - 1] : next > 0 ? stops[next - 1] : undefined;
  let x: number;
  let y: number;
  let ground: number;
  let lift = 0;
  let tilt = 0;
  let squash = 1;
  if (next !== -1 && t >= stops[next].at - HOP && (next > 0 || enter)) {
    const from = next > 0 ? stops[next - 1] : { x: enter![0], y: enter![1] };
    const to = stops[next];
    const p = (t - (to.at - HOP)) / HOP;
    const e = smooth(p);
    x = from.x + (to.x - from.x) * e;
    ground = from.y + (to.y - from.y) * e;
    const height = Math.max(90, Math.hypot(to.x - from.x, to.y - from.y) * 0.32);
    lift = height * 4 * p * (1 - p);
    y = ground - lift;
    tilt = Math.sign(to.x - from.x) * 12 * Math.sin(Math.PI * p);
    squash = p < 0.12 ? 0.88 : 1.08;
  } else {
    const at = resting ?? (enter ? { x: enter[0], y: enter[1], at: 0 } : stops[0]);
    x = at.x;
    y = ground = at.y;
    // Landing squash, then breathing.
    const since = resting ? t - resting.at : 99;
    const land = since < 0.4 ? spring({ frame: since * fps, fps, config: { damping: 9, stiffness: 220 } }) : 1;
    squash = since < 0.4 ? 0.78 + 0.22 * land : 1 + 0.025 * Math.sin((t * 2 * Math.PI) / 1.7);
  }
  const happy = Boolean(resting?.happy && next !== -1 ? t < stops[next].at - HOP : resting?.happy);

  // The bubble, while it stands where it was told to speak.
  const speaking = resting?.say && t >= resting.at + 0.15 && t < (resting.sayFor ? resting.at + resting.sayFor : next === -1 ? Infinity : stops[next].at - HOP);
  const said = speaking ? spring({ frame: (t - resting!.at - 0.15) * fps, fps, config: { damping: 14, stiffness: 180 } }) : 0;
  const leftSide = x > WIDTH - 640;

  return (
    <>
      {/* Its shadow on the ground, smaller the higher it hops. */}
      <div
        style={{
          position: "absolute",
          left: x - size * 0.34,
          top: ground - size * 0.07,
          width: size * 0.68,
          height: size * 0.14,
          borderRadius: "50%",
          background: "rgba(45, 32, 22, 0.28)",
          scale: String(interpolate(lift, [0, 160], [1, 0.55], { extrapolateRight: "clamp" })),
          opacity: interpolate(lift, [0, 160], [1, 0.4], { extrapolateRight: "clamp" }),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x - size / 2,
          top: y - size,
          width: size,
          height: size,
          transformOrigin: "50% 100%",
          scale: `${2 - squash} ${squash}`,
          rotate: `${tilt}deg`,
          filter: "drop-shadow(0 4px 0 rgba(45, 32, 22, 0.18))",
        }}
      >
        <MochiArt friend={friend} mood={happy ? "happy" : "idle"} />
      </div>
      {speaking && (
        <div
          style={{
            position: "absolute",
            ...(leftSide ? { right: WIDTH - x + size * 0.32 } : { left: x + size * 0.32 }),
            bottom: 1080 - (y - size * 0.82),
            maxWidth: 600,
            padding: "16px 26px 18px",
            background: C.paper,
            border: `3px solid ${C.ink}`,
            borderRadius: 24,
            boxShadow: `0 5px 0 ${C.ink}`,
            fontFamily: DISPLAY,
            fontSize: 36,
            fontWeight: 600,
            lineHeight: 1.18,
            color: C.ink,
            transformOrigin: leftSide ? "100% 100%" : "0% 100%",
            scale: String(0.6 + 0.4 * said),
            opacity: said,
          }}
        >
          {resting!.say}
        </div>
      )}
    </>
  );
};
