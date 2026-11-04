import React from "react";
import { Video } from "@remotion/media";
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import commits from "./commits.json";
import cut from "../public/footage/film-cut.json";
import { APP_SECONDS, HEX, PLAN, TAKE_SRC } from "./filmPlan";
import { CONCEPT_SECONDS, Concept } from "./Concept";
import { BrandMark, Grain, Night, SpeedBadge } from "./fx";
import { C, DISPLAY, HEIGHT, OUT, UI, WIDTH } from "./theme";

/**
 * The 1:05 film: the concept film (0:00-0:30), Aichen's five seconds cut fast against words
 * (0:30-0:35), the app in one take in a window that floats and drifts (0:35-0:59), and what was
 * built at the hackathon, and with what (0:59-1:05). No voice: words on screen, music, and sounds
 * made for it (public/sfx).
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const out = Easing.bezier(...OUT);

export const FAST_AT = 30;
export const FAST_SECONDS = 5;
export const APP_AT = FAST_AT + FAST_SECONDS;
export { APP_SECONDS };
export const END_AT = APP_AT + APP_SECONDS;
export const END_SECONDS = 6;
export const SHORT_SECONDS = END_AT + END_SECONDS;

// ─── Aichen, five seconds ───────────────────────────────────────────────────────────────────────

/**
 * Aichen's take (public/camera/<file>): one shot of 20-30 s, a shrug at the shelf, a box held up,
 * another, a look at the camera; each beat names its moment in it. Without the file the words keep
 * the same beat on their own.
 */
const FACE: { file: string | null } = { file: null };
type Beat = { seconds: number; face?: { at: number; close?: boolean }; card?: string; word?: string; light?: boolean; gold?: boolean };
const WITH_FACE: Beat[] = [
  { seconds: 0.6, face: { at: 1 } },
  { seconds: 0.5, card: "Game night?" },
  { seconds: 0.5, face: { at: 4, close: true } },
  { seconds: 0.45, card: "Played it." },
  { seconds: 0.5, face: { at: 7 } },
  { seconds: 0.45, card: "Played that." },
  { seconds: 0.5, face: { at: 10, close: true } },
  { seconds: 0.25, word: "So", light: true },
  { seconds: 0.25, word: "I", light: true },
  { seconds: 0.3, word: "built", light: true },
  { seconds: 0.7, word: "this.", gold: true },
];
const WORDS_ONLY: Beat[] = [
  { seconds: 1.2, card: "Game night?" },
  { seconds: 1.0, card: "Played it." },
  { seconds: 1.0, card: "Played that." },
  { seconds: 0.4, word: "So", light: true },
  { seconds: 0.4, word: "I", light: true },
  { seconds: 0.4, word: "built", light: true },
  { seconds: 0.6, word: "this.", gold: true },
];

const Card: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // A quick pop in, then a slow settle (the reference cuts' words).
  const pop = interpolate(t, [0, 0.09], [0.9, 1], clamp) * interpolate(t, [0.09, beat.seconds], [1, 0.97], clamp);
  const light = beat.light;
  const text = beat.card ?? beat.word ?? "";
  return (
    <AbsoluteFill style={{ background: light ? C.paper : C.night, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: beat.word ? DISPLAY : UI,
          fontWeight: beat.word ? 600 : 800,
          fontSize: beat.word ? 150 : 132,
          letterSpacing: beat.word ? "-0.02em" : "-0.03em",
          color: beat.gold ? C.gold : light ? C.ink : C.cream,
          scale: String(pop),
        }}
      >
        {text}
      </div>
      {!light && <Grain opacity={0.05} />}
    </AbsoluteFill>
  );
};

const Face: React.FC<{ beat: Beat }> = ({ beat }) => {
  const { fps } = useVideoConfig();
  const close = beat.face!.close;
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <Video
        src={staticFile(`camera/${FACE.file}`)}
        trimBefore={Math.round(beat.face!.at * fps)}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", scale: close ? "1.22" : "1", transformOrigin: "50% 38%" }}
      />
    </AbsoluteFill>
  );
};

export const FastCut: React.FC = () => {
  const { fps } = useVideoConfig();
  const beats = FACE.file ? WITH_FACE : WORDS_ONLY;
  let at = 0;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {beats.map((beat, i) => {
        const from = Math.round(at * fps);
        at += beat.seconds;
        const length = Math.round(at * fps) - from;
        return (
          <Sequence key={i} from={from} durationInFrames={length} layout="none">
            {beat.face ? <Face beat={beat} /> : <Card beat={beat} />}
            {!beat.face && <Audio src={staticFile("sfx/tick.wav")} volume={0.55} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// ─── The app, one take ──────────────────────────────────────────────────────────────────────────

/** The take's frames as the film plays them, written out as one clip by cut-film.mts, when that matches. */
const CUT = JSON.stringify(cut.stretches) === JSON.stringify(PLAN.stretches);

/** The take, laid out at the page's size and played by its stretches. */
const Take: React.FC = () => {
  const { fps } = useVideoConfig();
  if (CUT)
    return (
      <div style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT }}>
        <Video src={staticFile("footage/film-cut.mp4")} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      </div>
    );
  let start = 0;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT }}>
      {PLAN.stretches.map((s, i) => {
        const begin = start;
        start += s.seconds;
        return (
          <Sequence key={i} from={Math.round(begin * fps)} durationInFrames={Math.max(1, Math.round(start * fps) - Math.round(begin * fps))} layout="none">
            <Video src={staticFile(TAKE_SRC)} trimBefore={Math.max(0, Math.round(s.from * fps))} playbackRate={s.rate} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
          </Sequence>
        );
      })}
    </div>
  );
};

/** The window the app floats in: in from the lower right, settling, then a slow drift. */
const WINDOW = { width: 1408, height: 792 };
const AppWindow: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const enter = interpolate(t, [0, 1.0], [0, 1], { ...clamp, easing: out });
  const drift = t / APP_SECONDS;
  const ry = interpolate(enter, [0, 1], [-24, -5]) + 9 * drift;
  const rx = interpolate(enter, [0, 1], [12, 3]) - 2 * drift;
  const x = interpolate(enter, [0, 1], [720, 0]) + Math.sin(t / 3.1) * 8;
  const y = interpolate(enter, [0, 1], [430, -62]) + Math.sin(t / 2.3) * 6;
  const s = interpolate(enter, [0, 1], [0.86, 1]);
  return (
    <AbsoluteFill style={{ perspective: 2400, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: WINDOW.width,
          height: WINDOW.height,
          borderRadius: 22,
          overflow: "hidden",
          position: "relative",
          transform: `translate(${x}px, ${y}px) rotateY(${ry}deg) rotateX(${rx}deg) scale(${s})`,
          boxShadow: `0 60px 140px rgba(0,0,0,0.6), 0 0 0 1.5px ${C.gold}66`,
          opacity: interpolate(t, [0, 0.25], [0, 1], clamp),
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT, transformOrigin: "0 0", transform: `scale(${WINDOW.width / WIDTH})` }}>{children}</div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * A part of the page lifted out of the window, larger: the same moment of the take, so the shot
 * runs on under it. `region` is in the page's pixels; the card sits at `at` (its centre) in the frame.
 */
type Lift = { from: number; until: number; region: { x: number; y: number; w: number; h: number }; scale: number; at: [number, number]; label?: string };
const Callout: React.FC<{ lift: Lift }> = ({ lift }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const life = lift.until - lift.from;
  const show = interpolate(t, [lift.from, lift.from + 0.28], [0, 1], { ...clamp, easing: out }) * interpolate(t, [lift.until - 0.2, lift.until], [1, 0], clamp);
  if (show <= 0 || life <= 0) return null;
  const { region, scale } = lift;
  const w = region.w * scale;
  const h = region.h * scale;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: lift.at[0] - w / 2,
          top: lift.at[1] - h / 2,
          width: w,
          height: h,
          borderRadius: 16,
          overflow: "hidden",
          opacity: show,
          transform: `translateY(${(1 - show) * 24}px) scale(${0.9 + 0.1 * show})`,
          boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 0 2px ${C.gold}`,
          background: C.paper,
        }}
      >
        <div style={{ position: "absolute", left: -region.x * scale, top: -region.y * scale, width: WIDTH, height: HEIGHT, transformOrigin: "0 0", transform: `scale(${scale})` }}>
          <Take />
        </div>
      </div>
      {lift.label && (
        <div style={{ position: "absolute", left: lift.at[0] - w / 2, top: lift.at[1] + h / 2 + 14, opacity: show, fontFamily: UI, fontWeight: 650, fontSize: 24, color: C.goldSoft, letterSpacing: "0.02em" }}>{lift.label}</div>
      )}
      <Sequence from={Math.round(lift.from * fps)} durationInFrames={Math.round(0.3 * fps)} layout="none">
        <Audio src={staticFile("sfx/pop.wav")} volume={0.35} />
      </Sequence>
    </>
  );
};

/** A part's words: in fast from the right, settling at the lower left, word by word. */
type Words = { from: number; until: number; text: string; note?: string };
const Caption: React.FC<{ words: Words }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - words.from;
  const length = words.until - words.from;
  if (t < 0 || t > length) return null;
  const leave = interpolate(t, [length - 0.18, length], [1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 256, bottom: 34, maxWidth: 1500, display: "flex", alignItems: "baseline", gap: 30 }}>
      <div style={{ display: "flex", flexWrap: "nowrap", gap: "0 0.26em", fontFamily: DISPLAY, fontWeight: 600, fontSize: 64, lineHeight: 1.05, color: C.cream, textShadow: "0 6px 30px rgba(0,0,0,0.6)" }}>
        {words.text.split(" ").map((word, i) => {
          const p = interpolate(t, [i * 0.06, i * 0.06 + 0.42], [0, 1], { ...clamp, easing: out });
          return (
            <span key={i} style={{ display: "inline-block", opacity: p * leave, transform: `translateX(${(1 - p) * 140}px)` }}>
              {word}
            </span>
          );
        })}
      </div>
      {words.note && (
        <div style={{ fontFamily: UI, fontSize: 26, fontWeight: 600, color: C.goldSoft, whiteSpace: "nowrap", opacity: interpolate(t, [0.25, 0.55], [0, 1], clamp) * leave }}>{words.note}</div>
      )}
    </div>
  );
};

/** Says, the whole time the app is on, when it was made. */
const MadeHere: React.FC = () => (
  <div style={{ position: "absolute", left: 40, top: 34, display: "flex", alignItems: "center", gap: 12, padding: "9px 18px 9px 12px", borderRadius: 999, background: "rgba(18,13,10,0.72)", boxShadow: `0 0 0 1px ${C.gold}55` }}>
    <BrandMark size={28} />
    <span style={{ fontFamily: UI, fontSize: 21, fontWeight: 600, color: C.cream }}>Built during the Meta Global AI Developer Hackathon · Oct 26 – Nov 4, 2026</span>
  </div>
);

const s = (label: string, fallback: number) => PLAN.starts[label] ?? fallback;
/** The words over each part, by the parts' film times. */
const WORDS: Words[] = [
  { from: 0.3, until: s("ready", 2.6), text: "One sentence." },
  { from: s("ready", 2.6), until: s("table", 6), text: "Muse Spark designs it.", note: "Rules written as code · played 1,000 times · fixed" },
  { from: s("rivals", 6), until: s("rules", 7.6), text: "Your move." },
  { from: s("rules", 7.6), until: s("revise", 9.4), text: "Muse Spark Open takes the empty seat." },
  { from: s("revise", 9.4), until: s("balance-ready", 14), text: "House rules, in plain words.", note: "Rewritten by Muse Spark, playtested again" },
  { from: s("balance-ready", 14), until: s("painted", 15.8), text: "Balance, measured." },
  { from: s("painted", 15.8), until: s("print-preview", 18.2), text: "Painted by Muse Image.", note: "SAM 3.1 checks every tile" },
  { from: s("print-preview", 18.2), until: s("invite", 22.4), text: "Print and play.", note: "Our A4 kit: rules, board and cards" },
  { from: s("end", 22.4), until: APP_SECONDS + HEX, text: "Send a link. Play tonight." },
];

/** The speed of the take where it runs fast, by the parts that do. */
const BADGES: { part: string; real: string }[] = [
  { part: "ready", real: "the making" },
  { part: "balance-ready", real: "the playtests" },
  { part: "revised", real: "the rewrite" },
  { part: "painted", real: "the painting" },
];

/** Parts of the page lifted out over the take: set once the take is in (its regions are its own). */
const LIFTS: Lift[] = [
  // The idea as it is typed.
  { from: 0.75, until: s("dream", 1.85) - 0.05, region: { x: 618, y: 380, w: 690, h: 150 }, scale: 1.45, at: [980, 700] },
  // Each step of the making, ticked off.
  { from: s("ready", 2.6) + 0.4, until: s("table", 6) - 0.15, region: { x: 12, y: 50, w: 226, h: 446 }, scale: 1.35, at: [250, 470], label: "Muse Spark at work" },
  // Muse Spark Open taking its turn.
  { from: s("rules", 7.6) + 0.15, until: s("revise", 9.4) - 0.1, region: { x: 790, y: 1018, w: 340, h: 52 }, scale: 1.9, at: [960, 790] },
  // The rewrite's progress bar, then the two versions side by side.
  { from: s("revised", 10.6) + 0.1, until: s("version-two", 12.8) - 0.05, region: { x: 1664, y: 415, w: 244, h: 140 }, scale: 2.1, at: [1540, 480], label: "Rewritten and playtested again" },
  { from: s("version-two", 12.8), until: s("balance-ready", 14) - 0.05, region: { x: 1664, y: 376, w: 244, h: 254 }, scale: 1.75, at: [1560, 470], label: "Version two, beside version one" },
  // The profile filling in as its games are played.
  { from: s("paint", 15) - 0.3, until: s("painted", 15.8) - 0.05, region: { x: 1664, y: 162, w: 244, h: 276 }, scale: 1.7, at: [1560, 460] },
  // Muse Image painting, SAM 3.1 checking.
  { from: s("painted", 15.8) + 0.1, until: s("print", 17.2) - 0.1, region: { x: 1664, y: 96, w: 244, h: 150 }, scale: 2.0, at: [1560, 430] },
];

export const AppShot: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <Night glow={C.gold}>
      <AppWindow>
        <Take />
      </AppWindow>
      {LIFTS.map((lift, i) => (
        <Callout key={i} lift={lift} />
      ))}
      {WORDS.map((w, i) => (
        <React.Fragment key={i}>
          <Caption words={w} />
          <Sequence from={Math.round(w.from * fps)} durationInFrames={Math.round(0.3 * fps)} layout="none">
            <Audio src={staticFile("sfx/tick.wav")} volume={0.4} />
          </Sequence>
        </React.Fragment>
      ))}
      {BADGES.filter((b) => PLAN.rates[b.part] > 3).map((b) => (
        <Sequence key={b.part} from={Math.round((PLAN.starts[b.part] + 0.15) * fps)} durationInFrames={Math.round(1.6 * fps)} layout="none">
          <div style={{ position: "absolute", right: 70, bottom: 36 }}>
            <SpeedBadge factor={Math.round(PLAN.rates[b.part])} real={b.real} />
          </div>
        </Sequence>
      ))}
      <MadeHere />
      <Audio src={staticFile("sfx/whoosh.wav")} volume={0.5} />
    </Night>
  );
};

// ─── What was built, and with what ──────────────────────────────────────────────────────────────

const BUILT = ["The game-design pipeline", "Rules engine and 1,000-game playtester", "Library of 27 tested mechanics", "3D table with physics", "House rules, balance, art, print and play", "Tables with friends, and the mochi game"];
const USED = ["Muse Spark: designs and fixes", "Muse Spark Open: plays the empty seats", "Muse Image: paints", "SAM 3.1: checks the art", "Open source: React, three.js, Rapier"];

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const most = Math.max(...commits.map((c) => c.commits));
  const total = commits.reduce((sum, c) => sum + c.commits, 0);
  const rise = (delay: number) => interpolate(t, [delay, delay + 0.5], [0, 1], { ...clamp, easing: out });
  const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <Night glow={C.gold}>
      <AbsoluteFill style={{ padding: "90px 110px", display: "grid", gridTemplateColumns: "1fr 720px", gridTemplateRows: "auto 1fr auto", columnGap: 90 }}>
        <div style={{ gridColumn: 1, gridRow: 1, opacity: rise(0.1), transform: `translateY(${(1 - rise(0.1)) * 30}px)` }}>
          <div style={{ fontFamily: UI, fontSize: 24, fontWeight: 700, letterSpacing: "0.14em", color: C.gold }}>META GLOBAL AI DEVELOPER HACKATHON</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 92, fontWeight: 600, lineHeight: 1.04, color: C.cream, marginTop: 14, whiteSpace: "nowrap" }}>
            Built from scratch,
            <br />
            Oct 26 – Nov 4.
          </div>
        </div>
        {/* Commits a day, the first to the last. */}
        <div style={{ gridColumn: 2, gridRow: "1 / 3", display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 30 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 300 }}>
            {commits.map((c, i) => {
              const p = rise(0.35 + i * 0.06);
              return (
                <div key={c.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ fontFamily: UI, fontSize: 18, fontWeight: 700, color: C.goldSoft, opacity: p }}>{c.commits}</div>
                  <div style={{ width: "100%", height: Math.max(4, (250 * c.commits) / most) * p, borderRadius: 6, background: `linear-gradient(${C.goldSoft}, ${C.gold})` }} />
                  <div style={{ fontFamily: UI, fontSize: 15, color: C.creamMuted, whiteSpace: "nowrap" }}>{day(c.day)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontFamily: UI, fontSize: 24, fontWeight: 600, color: C.cream, marginTop: 18, opacity: rise(1) }}>{total} commits, every one in the public repository</div>
        </div>
        <div style={{ gridColumn: 1, gridRow: 2, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignContent: "end", paddingBottom: 20 }}>
          {[
            { title: "We built", items: BUILT, color: C.gold },
            { title: "Powered by", items: USED, color: C.teal },
          ].map((col, k) => (
            <div key={col.title} style={{ opacity: rise(0.7 + k * 0.2) }}>
              <div style={{ fontFamily: UI, fontSize: 22, fontWeight: 800, letterSpacing: "0.1em", color: col.color, marginBottom: 12 }}>{col.title.toUpperCase()}</div>
              {col.items.map((item, i) => (
                <div key={item} style={{ fontFamily: UI, fontSize: 25, lineHeight: 1.5, color: C.cream, opacity: rise(0.8 + k * 0.2 + i * 0.07) }}>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ gridColumn: "1 / 3", gridRow: 3, display: "flex", alignItems: "center", gap: 18, opacity: rise(2.2) }}>
          <BrandMark size={54} />
          <span style={{ fontFamily: DISPLAY, fontSize: 52, fontWeight: 600, color: C.cream }}>boarddream.pages.dev</span>
          <span style={{ fontFamily: UI, fontSize: 26, color: C.creamMuted, marginLeft: 24 }}>Dream it up. Play it tonight.</span>
        </div>
      </AbsoluteFill>
    </Night>
  );
};

// ─── The hand-over: the next part opens in a growing hex ────────────────────────────────────────

const HexOpen: React.FC<{ seconds: number; children: React.ReactNode }> = ({ seconds, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame / fps, [0, seconds], [0, 1], { ...clamp, easing: Easing.bezier(0.7, 0, 0.3, 1) });
  // A pointy-top hex, from nothing to past the frame's corners, turning a little as it grows.
  const r = p * 1.25 * Math.hypot(WIDTH, HEIGHT) * 0.5;
  const turn = (1 - p) * 0.5;
  const points = Array.from({ length: 6 }, (_, i) => {
    const a = turn + (Math.PI / 3) * i - Math.PI / 2;
    return `${WIDTH / 2 + r * Math.cos(a)}px ${HEIGHT / 2 + r * Math.sin(a)}px`;
  }).join(", ");
  return <AbsoluteFill style={{ clipPath: p >= 1 ? undefined : `polygon(${points})` }}>{children}</AbsoluteFill>;
};

// ─── The film ───────────────────────────────────────────────────────────────────────────────────

const sec = (s: number, fps: number) => Math.round(s * fps);

export const Short: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Sequence durationInFrames={sec(CONCEPT_SECONDS, fps)} name="BoardDream, a concept film">
        <Concept />
      </Sequence>
      <Sequence from={sec(FAST_AT, fps)} durationInFrames={sec(FAST_SECONDS, fps)} name="Aichen, five seconds">
        <FastCut />
      </Sequence>
      <Sequence from={sec(APP_AT - HEX, fps)} durationInFrames={sec(APP_SECONDS + HEX, fps)} name="The app, one take">
        <HexOpen seconds={HEX}>
          <AppShot />
        </HexOpen>
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.45} />
      </Sequence>
      <Sequence from={sec(END_AT - HEX, fps)} durationInFrames={sec(END_SECONDS + HEX, fps)} name="Built at the hackathon">
        <HexOpen seconds={HEX}>
          <EndCard />
        </HexOpen>
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.45} />
      </Sequence>
    </AbsoluteFill>
  );
};

export { WINDOW };
