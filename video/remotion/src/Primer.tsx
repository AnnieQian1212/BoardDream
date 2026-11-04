import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Eyebrow, Footage, Night, Rise, SpeedBadge, Subtitles, T, Wordmark, ease, type Cue, type Move } from "./fx";
import { Timeline, sceneSeconds, type Scene } from "./timeline";
import { C, DISPLAY, UI } from "./theme";
import after from "../public/footage/after.json";
import making from "../public/footage/making.json";
import { TwoWays } from "./Flows";

/**
 * Part 2, after Linear's primers: Aichen on camera between the app's shots, the app filling the frame
 * while the voice goes on, subtitles along the bottom, a handover at every cut. The game made here is
 * Basalt Kin, made for real at high effort in the making take; the after take plays it on.
 */
export const BUILDER = "Aichen Qian";

type Take = "intro" | "why" | "close";

/**
 * Aichen's camera takes (head and shoulders, any landscape clip in public/camera/), once recorded,
 * and the two or three words that stand beside each, at the moment (seconds of Part 2) they are said.
 */
const CAMERA: Record<Take, { file: string | null; points: { at: number; text: string }[] }> = {
  intro: {
    file: null,
    points: [
      { at: 4.2, text: "Game night, every week" },
      { at: 8.6, text: "Played everything on the shelf" },
      { at: 12.8, text: "One sentence. Play tonight." },
    ],
  },
  why: {
    file: null,
    points: [
      { at: 91.8, text: "Game night keeps us close" },
      { at: 94.8, text: "A new game keeps it fresh" },
    ],
  },
  close: {
    file: null,
    points: [
      { at: 113.4, text: "Built at this hackathon" },
      { at: 116.8, text: "boarddream.pages.dev" },
    ],
  },
};

/** Where things happen in a take (video/record/takes.mjs marks them), in seconds. */
const marker = (take: { marks: { label: string; t: number }[] }, name: string) => (label: string) => {
  const found = take.marks.find((m) => m.label === label);
  if (!found) throw new Error(`the ${name} take has no mark "${label}"`);
  return found.t;
};
const inAfter = marker(after, "after");
const inMaking = marker(making, "making");
const AFTER = {
  // The take opens on the table (its first mark comes before its first frame).
  table: 0,
  rivals: inAfter("rivals"),
  rules: inAfter("rules"),
  revise: inAfter("revise"),
  revised: inAfter("revised"),
  paint: inAfter("paint"),
  painted: inAfter("painted"),
  paintedTable: inAfter("painted-table"),
  invite: inAfter("invite"),
};
const MAKING = {
  dream: inMaking("dream"),
  // The first time a pair of mochi is put together while the game is made.
  mochi: inMaking("mochi"),
  ready: inMaking("ready"),
};
const minSec = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`);

/** The narration, as it is meant to be read; the subtitles until Aichen records it. */
const NARRATION: Cue[] = [
  { start: 3.4, end: 8.2, text: "Hi, I'm Aichen Qian. Every week my friends and I have a game night," },
  { start: 8.2, end: 12.4, text: "and we'd played everything on the shelf." },
  { start: 12.4, end: 17.8, text: "So I built BoardDream: describe a game in one sentence, and play it together tonight." },
  { start: 18.2, end: 22.6, text: "Tonight we want something big: rival families on volcanic islands." },
  { start: 22.6, end: 26.8, text: "I turn the complexity all the way up, and press Dream it up." },
  { start: 27.2, end: 33.2, text: "Muse Spark, Meta's model, designs the game: the islands, the cards, how you win." },
  { start: 33.4, end: 38, text: "While it's being made, there's a little mochi game to pass the time." },
  { start: 38.4, end: 43.4, text: "It picks tested mechanics from our library and writes the rules as real code." },
  { start: 43.4, end: 48.8, text: "Before anyone plays, bots run a thousand games, and anything that breaks goes back to Muse Spark." },
  { start: 49.2, end: 52.8, text: "About six and a half minutes later, the game is ready." },
  { start: 53.2, end: 55.8, text: "Islands, harbors, lighthouses, and cards that chain together." },
  { start: 56.2, end: 62.8, text: "If a friend can't make it, Muse Spark Open, Meta's open-weight model, takes the empty seat." },
  { start: 63.2, end: 68.6, text: "Every group has house rules. We ask for a change in plain words," },
  { start: 68.6, end: 76.8, text: "and it's rewritten and tested again, as version two." },
  { start: 77.2, end: 84.8, text: "Muse Image paints the board, and SAM 3.1 checks every painted tile sits on the real one." },
  { start: 85.2, end: 90.8, text: "Then I send my friends a link, and we play at one table." },
  { start: 91.2, end: 94.6, text: "Why build this? Game night is how we stay close," },
  { start: 94.6, end: 97.8, text: "and a new game keeps it fresh." },
  { start: 98.2, end: 102, text: "But testing your own idea takes weeks of paper prototypes." },
  { start: 102, end: 105.8, text: "BoardDream gives your table a game that has already been played a thousand times." },
  { start: 106.2, end: 112.8, text: "Four Meta models, each with a job: Muse Spark designs, Muse Spark Open plays, Muse Image paints, SAM 3.1 checks." },
  { start: 113.2, end: 116.6, text: "Everything you saw was built during this hackathon." },
  { start: 116.6, end: 119.8, text: "Try it at boarddream.pages.dev, and play something new with your friends tonight." },
];

/** Aichen's face in a gold ring, or a quiet stand-in until the take is recorded. */
const Portrait: React.FC<{ file: string | null; t: number; size: number }> = ({ file, t, size }) => {
  const p = ease(Math.min(1, Math.max(0, t / 0.8)));
  const ring = ease(Math.min(1, Math.max(0, (t - 0.1) / 1.1)));
  const r = size / 2;
  return (
    <div style={{ position: "relative", width: size, height: size, scale: String(0.92 + 0.08 * p), opacity: p }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", background: C.night2, boxShadow: `0 30px 90px rgba(0,0,0,0.55), 0 0 80px ${C.gold}33` }}>
        {file ? (
          <Video src={staticFile(file)} muted objectFit="cover" style={{ width: "100%", height: "100%" }} />
        ) : (
          <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%" }}>
            <circle cx="100" cy="82" r="34" fill="#3a2e24" />
            <path d="M38 200c4-46 30-70 62-70s58 24 62 70Z" fill="#3a2e24" />
          </svg>
        )}
      </div>
      <svg viewBox={`0 0 ${size + 60} ${size + 60}`} style={{ position: "absolute", left: -30, top: -30, width: size + 60, height: size + 60, overflow: "visible" }}>
        <circle cx={r + 30} cy={r + 30} r={r + 3} fill="none" stroke={C.gold} strokeWidth={5} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ring} transform={`rotate(-90 ${r + 30} ${r + 30})`} />
        <circle
          cx={r + 30}
          cy={r + 30}
          r={r + 22}
          fill="none"
          stroke={C.goldSoft}
          strokeWidth={1.5}
          strokeDasharray="3 11"
          opacity={0.55 * ring}
          transform={`rotate(${t * 6} ${r + 30} ${r + 30})`}
        />
      </svg>
    </div>
  );
};

/**
 * Aichen on camera: the face in a gold ring on the left, over the app softly out of focus, and the
 * two or three words of what is being said on the right, each arriving as it is said; the subtitles
 * carry the rest along the bottom. The first time, the name under the face.
 */
const OnCamera: React.FC<{ take: Take; start: number; lead: number; named?: boolean }> = ({ take, start, lead, named }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame / fps - lead;
  const t = local + start;
  const { file, points } = CAMERA[take];
  const said = points.filter((pt) => t >= pt.at);
  const name = ease(Math.min(1, Math.max(0, (local - 0.6) / 0.8)));
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <AbsoluteFill style={{ filter: "blur(26px) brightness(0.42) saturate(0.85)", scale: "1.12" }}>
        <Footage src="footage/table.mp4" from={{ intro: 2, why: 10, close: 18 }[take]} lead={lead} rate={0.6} zoom={[1.15, 1.25]} focus={[[900, 500], [1000, 520]]} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 46%, transparent 0%, ${C.night}99 55%, ${C.night}e6 100%)` }} />
      <div style={{ position: "absolute", left: 300, top: 190, display: "flex", flexDirection: "column", alignItems: "center", gap: 46 }}>
        <Portrait file={file} t={local} size={540} />
        {named && (
          <div style={{ textAlign: "center", opacity: name, translate: `0px ${(1 - name) * 16}px` }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 50, fontWeight: 600, color: C.cream }}>{BUILDER}</div>
            <div style={{ fontFamily: UI, fontSize: 24, fontWeight: 500, letterSpacing: "0.04em", color: C.creamMuted, marginTop: 6 }}>built BoardDream at this hackathon</div>
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: 1010, right: 110, top: 0, bottom: 120, display: "flex", flexDirection: "column", justifyContent: "center", gap: 40 }}>
        {said.map((pt, i) => {
          const p = ease(Math.min(1, Math.max(0, (t - pt.at) / 0.7)));
          const latest = i === said.length - 1;
          return (
            <div key={pt.text} style={{ display: "flex", alignItems: "baseline", gap: 26, opacity: p * (latest ? 1 : 0.42), translate: `${(1 - p) * 40}px 0px` }}>
              <div style={{ width: 34, height: 3, background: C.gold, flexShrink: 0, translate: "0px -18px" }} />
              <div style={{ fontFamily: DISPLAY, fontSize: 66, fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.01em", color: C.cream }}>{pt.text}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Four Meta models and what each does here. */
const Models: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const models = [
    ["Muse Spark", "designs each game and writes its rules as code"],
    ["Muse Spark Open", "plays the empty seats, and talks at the table"],
    ["Muse Image", "paints the covers, the cards and the board"],
    ["SAM 3.1", "checks every painted tile sits on the real one"],
  ];
  return (
    <Night>
      <AbsoluteFill style={{ padding: "150px 130px", gap: 70 }}>
        <div>
          <Eyebrow text="Built on Meta's models" delay={0.1} />
          <Rise text="Four models. Each with a job." size={92} delay={0.25} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 48 }}>
          {models.map(([name, job], i) => {
            const p = ease(Math.min(1, Math.max(0, (t - 0.9 - i * 0.22) / 0.8)));
            return (
              <div key={name} style={{ opacity: p, translate: `0px ${(1 - p) * 40}px` }}>
                <div style={{ height: 3, width: `${p * 100}%`, background: C.gold, marginBottom: 28 }} />
                <div style={{ fontFamily: DISPLAY, fontSize: 48, fontWeight: 600, color: C.goldSoft }}>{name}</div>
                <div style={{ fontFamily: UI, fontSize: 30, lineHeight: 1.4, color: C.cream, marginTop: 14 }}>{job}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Night>
  );
};

const take = (src: string, from: number, opts: { rate?: number; camera?: Move[] } = {}) =>
  function Take(lead: number) {
    return <Footage src={src} from={from} lead={lead} rate={opts.rate} camera={opts.camera} />;
  };

const M = "footage/making.mp4";
const A = "footage/after.mp4";

/** A sped-up stretch: plays `[from, to]` of a take in `seconds`. */
const fast = (from: number, to: number, seconds: number) => ({ from, rate: (to - from) / seconds });

/** The making, played at one speed either side of the mochi, which plays as it happened. */
const MAKING_RATE = 17;
const designing = { from: MAKING.dream + 0.2, rate: MAKING_RATE };
const testing = { from: MAKING.ready - 11 * MAKING_RATE, rate: MAKING_RATE };
const revising = fast(AFTER.revise, AFTER.revised, 4);
const painting = fast(AFTER.paint, AFTER.painted, 4);

const SCENES: Scene[] = [
  {
    name: "Title",
    seconds: 3,
    render: () => (
      <Night>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 22 }}>
          <Wordmark size={70} />
          <Rise text="How BoardDream works" size={100} delay={0.3} />
          <Eyebrow text={`A primer with ${BUILDER}`} delay={0.6} color={C.goldSoft} />
        </AbsoluteFill>
      </Night>
    ),
    then: T.fade(0.67),
  },
  { name: "Aichen: who and why", seconds: 15, render: (lead) => <OnCamera take="intro" start={3} lead={lead} named />, then: T.blur() },
  {
    name: "The idea",
    seconds: 9,
    render: take(M, 1, {
      rate: 2.6,
      camera: [
        { at: 0, zoom: 1.02, focus: [960, 540] },
        { at: 0.5, zoom: 1.4, focus: [960, 330] },
        { at: 4.1, zoom: 1.3, focus: [960, 660] },
        { at: 7.4, zoom: 1.45, focus: [1180, 420] },
      ],
    }),
    then: T.blur(0.6),
  },
  {
    name: "Muse Spark designs",
    seconds: 6.5,
    render: take(M, designing.from, {
      rate: designing.rate,
      camera: [
        { at: 0, zoom: 1.0, focus: [960, 540] },
        { at: 0.6, zoom: 1.35, focus: [800, 300] },
        { at: 3.3, zoom: 1.4, focus: [1560, 330] },
      ],
    }),
    then: T.push(0.6, "from-bottom"),
  },
  {
    name: "A game while you wait",
    seconds: 4.5,
    render: take(M, MAKING.mochi - 0.2, { rate: 1.4, camera: [{ at: 0, zoom: 1.5, focus: [760, 980] }] }),
    then: T.push(0.6, "from-top"),
  },
  {
    name: "Rules as code, tested",
    seconds: 11,
    render: take(M, testing.from, {
      rate: testing.rate,
      camera: [
        { at: 0, zoom: 1.1, focus: [1110, 400] },
        { at: 5.2, zoom: 1.45, focus: [330, 470] },
        { at: 9.2, zoom: 1.25, focus: [420, 520] },
      ],
    }),
    then: T.blur(0.5),
  },
  // The table fades in behind the finished list a second after the game is ready; the cut to the
  // table is a soft dissolve from the same table, not a click.
  {
    name: "Ready",
    seconds: 4,
    render: take(M, MAKING.ready + 0.1, {
      camera: [
        { at: 0, zoom: 1.4, focus: [330, 560] },
        { at: 1.9, zoom: 1.12, focus: [1080, 470] },
      ],
    }),
    then: T.fade(0.6),
  },
  {
    name: "The table",
    seconds: 3,
    render: take(A, AFTER.table + 0.5, {
      camera: [
        { at: 0, zoom: 1.12, focus: [1000, 470] },
        { at: 0.7, zoom: 1.45, focus: [780, 330] },
      ],
    }),
    then: T.leak(1, 5),
  },
  {
    name: "Muse Spark Open",
    seconds: 7,
    render: take(A, AFTER.rivals + 2, {
      rate: 1.4,
      camera: [
        { at: 0, zoom: 1.0, focus: [960, 540] },
        { at: 2.4, zoom: 1.22, focus: [820, 430] },
      ],
    }),
    then: T.push(0.67, "from-left"),
  },
  {
    name: "A house rule",
    seconds: 6,
    render: take(A, AFTER.rules + 0.3, {
      rate: 1.3,
      camera: [
        { at: 0, zoom: 1.05, focus: [960, 540] },
        { at: 0.5, zoom: 1.45, focus: [1640, 560] },
      ],
    }),
    then: T.blur(0.53),
  },
  {
    name: "Rewritten and tested",
    seconds: 4,
    render: take(A, revising.from, { rate: revising.rate, camera: [{ at: 0, zoom: 1.3, focus: [1550, 580] }] }),
    then: T.blur(0.53),
  },
  {
    name: "Version two",
    seconds: 4,
    render: take(A, AFTER.revised + 0.6, {
      rate: 1.2,
      camera: [
        { at: 0, zoom: 1.4, focus: [1700, 650] },
        { at: 2.1, zoom: 1.3, focus: [640, 380] },
      ],
    }),
    then: T.wipe(0.8, 80),
  },
  {
    name: "Painting",
    seconds: 4,
    render: take(A, painting.from, {
      rate: painting.rate,
      camera: [
        { at: 0, zoom: 1.0, focus: [960, 540] },
        { at: 1.2, zoom: 1.35, focus: [1560, 330] },
      ],
    }),
    then: T.blur(0.53),
  },
  {
    name: "Painted",
    seconds: 4,
    render: take(A, AFTER.paintedTable + 0.4, {
      camera: [
        { at: 0, zoom: 1.05, focus: [960, 540] },
        { at: 0.6, zoom: 1.5, focus: [740, 330] },
      ],
    }),
    then: T.push(0.67, "from-bottom"),
  },
  {
    name: "Invite friends",
    seconds: 6,
    render: take(A, AFTER.invite - 1.2, {
      rate: 0.9,
      camera: [
        { at: 0, zoom: 1.0, focus: [960, 540] },
        { at: 1.6, zoom: 1.35, focus: [960, 520] },
      ],
    }),
    then: T.leak(1.13, 9),
  },
  { name: "Aichen: why", seconds: 7, render: (lead) => <OnCamera take="why" start={91} lead={lead} />, then: T.blur() },
  { name: "Two ways to make a game", seconds: 8, render: (lead) => <TwoWays lead={lead} />, then: T.wipe(0.87) },
  { name: "Four models", seconds: 7, render: () => <Models />, then: T.blur() },
  { name: "Aichen: close", seconds: 7, render: (lead) => <OnCamera take="close" start={113} lead={lead} />, then: T.fade(0.67) },
  {
    name: "End",
    seconds: 3,
    render: () => (
      <Night>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
          <Wordmark size={100} />
          <Rise text="Describe a game. Play it with your friends tonight." size={50} delay={0.3} italic color={C.goldSoft} weight={400} />
          <div style={{ fontFamily: UI, fontSize: 32, fontWeight: 600, letterSpacing: "0.12em", color: C.creamMuted }}>boarddream.pages.dev</div>
        </AbsoluteFill>
      </Night>
    ),
  },
];

export const PRIMER_SECONDS = sceneSeconds(SCENES);

export const Primer: React.FC = () => {
  const { fps } = useVideoConfig();
  const sec = (s: number) => Math.round(s * fps);
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Timeline scenes={SCENES} />
      {/* The making plays at one speed; the mochi between plays as it happened. */}
      <Sequence from={sec(27.4)} durationInFrames={sec(5.8)} layout="none">
        <SpeedBadge factor={MAKING_RATE} real={minSec(MAKING.ready - MAKING.dream)} />
      </Sequence>
      <Sequence from={sec(38.4)} durationInFrames={sec(10.2)} layout="none">
        <SpeedBadge factor={MAKING_RATE} real={minSec(MAKING.ready - MAKING.dream)} />
      </Sequence>
      <Sequence from={sec(69.3)} durationInFrames={sec(3.5)} layout="none">
        <SpeedBadge factor={Math.round(revising.rate)} real={minSec(AFTER.revised - AFTER.revise)} />
      </Sequence>
      <Sequence from={sec(77.3)} durationInFrames={sec(3.5)} layout="none">
        <SpeedBadge factor={Math.round(painting.rate)} real={minSec(AFTER.painted - AFTER.paint)} />
      </Sequence>
      {/* Over the mochi, which sits along the bottom of the page, the subtitles go to the top. */}
      <Subtitles cues={NARRATION} high={[[33.4, 38.2]]} />
    </AbsoluteFill>
  );
};
