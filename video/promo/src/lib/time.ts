// The film's clock. Everything is timed in seconds of film time and laid on the music's grid:
// Cat Walk (Arulo, Mixkit) measured with librosa at 129.995 BPM, first downbeat 0.7085 s into the
// file, grid residual 9 ms (capture/beats.py). Film second 0 is that first downbeat.
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

export const FPS = 60;
export const BEAT = 0.46156; // s
export const BAR = BEAT * 4; // 1.84624 s
/** Where film second 0 sits in the music file. */
export const MUSIC_OFFSET = 0.7085;

/** Film seconds at the start of bar n (1-based) and at beat b (0-based) from the top. */
export const barS = (n: number) => (n - 1) * BAR;
export const beatS = (b: number) => b * BEAT;
/** Seconds to frames at the film's rate. */
export const sf = (s: number) => Math.round(s * FPS);

/** Seconds since the enclosing Sequence began. */
export const useSec = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

/** 0..1 over [a, b] seconds, clamped, eased. */
export const prog = (t: number, a: number, b: number, ease: (x: number) => number = Easing.bezier(0.16, 1, 0.3, 1)) =>
  interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** BoardDream's motion voice (shotcraft "活泼愉悦/活力" presets, a storybook game, not a bank). */
export const EASE = {
  /** Entrances: fast out, long settle. */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** Landing with a small overshoot (y1 > 1). */
  land: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** Camera moves. */
  cam: Easing.bezier(0.33, 0, 0.15, 1),
  /** Exits: accelerate away. */
  in: Easing.bezier(0.7, 0, 0.84, 0),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
};

/** Deterministic noise (mulberry32), seeded by index. */
export const rand = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
