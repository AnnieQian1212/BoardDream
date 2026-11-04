import React from "react";
import { AbsoluteFill, Audio, Sequence, getInputProps, interpolate, staticFile, useVideoConfig } from "remotion";
import { Carousel, Friends, Mochi, Play, Question } from "./Concept";
import { BAR, HEX, PLAN } from "./filmPlan";
import { TwoWays } from "./Flows";
import { Eyebrow, Night, Rise, T } from "./fx";
import { hexIris } from "./hexIris";
import { Outro } from "./Outro";
import { Models } from "./Primer";
import { AppShot } from "./Short";
import { C, FPS, UI } from "./theme";
import { Timeline, type Scene } from "./timeline";

/**
 * The one-minute promo (video-shotcraft, free creation): no voice, House Vibez under it (Mixkit
 * free licence, 122 BPM measured), every cut on a bar. A low open, the games, the old way against
 * BoardDream, the app in one take, the mochi game, friends at one table, the four models in the
 * music's breakdown, a table in play, what was built at the hackathon, and the group photo on the
 * drop. `bgm: false` renders it without the music, keeping the sounds.
 */

/** Where the music's first beat (bar 1) is in House Vibez: the film starts there. */
const MUSIC_FROM = 7.9378;
const bars = (n: number) => n * BAR;

const Hackathon: React.FC = () => (
  <Night>
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 150px", gap: 26 }}>
      <Eyebrow text="Meta Global AI Developer Hackathon" delay={0.05} />
      <Rise text="Built from scratch in ten days." size={104} delay={0.15} />
      <div style={{ fontFamily: UI, fontSize: 38, fontWeight: 600, color: C.creamMuted }}>Oct 26 – Nov 4, 2026 · every feature in this film</div>
    </AbsoluteFill>
  </Night>
);

const SCENES: Scene[] = [
  { name: "What do you want to play tonight?", seconds: bars(2), render: (lead) => <Question lead={lead} />, then: T.fade(0.4) },
  { name: "Every game", seconds: bars(2), render: (lead) => <Carousel lead={lead} /> },
  { name: "Two ways to make a game", seconds: bars(3), render: (lead) => <TwoWays lead={lead} speed={1.25} />, then: { transition: hexIris(), frames: Math.round(HEX * 2 * FPS) } },
  { name: "The app, one take", seconds: bars(11), render: () => <AppShot sounds={false} /> },
  { name: "While your game is made", seconds: bars(2), render: (lead) => <Mochi lead={lead} /> },
  { name: "Friends at one table", seconds: bars(1.5), render: (lead) => <Friends lead={lead} />, then: T.fade(0.4) },
  { name: "Four models", seconds: bars(3), render: () => <Models /> },
  { name: "Tonight, your move", seconds: bars(2), render: (lead) => <Play lead={lead} />, then: T.fade(0.4) },
  { name: "Built at the hackathon", seconds: bars(1.5), render: () => <Hackathon /> },
  { name: "The group photo", seconds: bars(2.5), render: () => <Outro seconds={bars(2.5)} /> },
];

export const PROMO_SECONDS = SCENES.reduce((sum, s) => sum + s.seconds, 0);
/** When each scene starts, in film seconds. */
const at: Record<string, number> = {};
SCENES.reduce((t, s) => ((at[s.name] = t), t + s.seconds), 0);
const app = at["The app, one take"] - HEX;
const outro = at["The group photo"];

/** Every sound, by what it is for: film seconds, file, volume, and how long it may play. */
const SFX: { at: number; src: string; volume: number; seconds?: number; loop?: boolean; why: string }[] = [
  { at: app + 0.05, src: "audio/sfx/fs-855734.mp3", volume: 0.5, why: "the hex opens on the app" },
  { at: app + 0.45, src: "audio/sfx/fs-690655.mp3", volume: 0.45, seconds: Math.max(0.4, (PLAN.starts.dream ?? 2) - 0.45), loop: true, why: "the idea typed" },
  { at: app + (PLAN.starts.ready ?? 3) - 0.08, src: "audio/sfx/fs-687107.mp3", volume: 1, why: "Dream it up clicked" },
  { at: app + (PLAN.starts.revised ?? 10) - 0.08, src: "audio/sfx/fs-687107.mp3", volume: 1, why: "Apply the change clicked" },
  { at: at["Built at the hackathon"], src: "audio/sfx/fs-806666.mp3", volume: 0.4, seconds: bars(1.5), why: "the riser into the drop" },
  { at: outro + 0.05, src: "audio/sfx/fs-855734.mp3", volume: 0.45, why: "the pieces fly in" },
  { at: outro + 42 / 30 - 0.095, src: "audio/sfx/fs-802966.mp3", volume: 0.6, why: "the mark is pressed in" },
  { at: outro + 58 / 30 - 0.255, src: "audio/sfx/fs-462095.mp3", volume: 0.35, why: "the rule draws out" },
];

export const Promo: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const bgm = (getInputProps() as { bgm?: boolean }).bgm !== false;
  const end = durationInFrames / fps;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Timeline scenes={SCENES} />
      {bgm && (
        <Audio
          src={staticFile("audio/bgm/house-vibez.mp3")}
          trimBefore={Math.round(MUSIC_FROM * fps)}
          volume={(f) => 0.55 * interpolate(f / fps, [0, 0.2, end - 0.9, end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      )}
      {SFX.map((s, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(s.at * fps))} durationInFrames={s.seconds ? Math.round(s.seconds * fps) : undefined} layout="none" name={`sfx: ${s.why}`}>
          <Audio src={staticFile(s.src)} volume={s.volume} loop={s.loop} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
