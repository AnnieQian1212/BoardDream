import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COVERS } from "./Reel";
import { CoverWall, Eyebrow, Footage, LowerThird, Night, Rise, SpeedBadge, Subtitles, T, Wordmark, ease, type Cue } from "./fx";
import { Timeline, sceneSeconds, type Scene } from "./timeline";
import { C, DISPLAY, UI } from "./theme";
import after from "../public/footage/after.json";

/**
 * Part 2, after Linear's primers: Aichen on camera (full frame, cut between, never over the app),
 * the app full frame while the voice goes on, subtitles along the bottom, a handover at every cut.
 * The game made here is Copper Grind, made for real in the primer take; the after take plays it
 * on with no first-game guide over the table.
 */
export const BUILDER = "Aichen Qian";

/** Aichen's camera takes, once recorded (public/camera/...); until then the line is set in type. */
const CAMERA: Record<"intro" | "why" | "close", string | null> = { intro: null, why: null, close: null };

/** Where things happen in the after take (video/record/takes.mjs marks them), in seconds. */
const mark = (label: string) => {
  const found = after.marks.find((m) => m.label === label);
  if (!found) throw new Error(`the after take has no mark "${label}"`);
  return found.t;
};
const AFTER = {
  // The take opens on the table (its first mark comes before its first frame).
  table: 0,
  rivals: mark("rivals"),
  rules: mark("rules"),
  revise: mark("revise"),
  revised: mark("revised"),
  paint: mark("paint"),
  painted: mark("painted"),
  paintedTable: mark("painted-table"),
  invite: mark("invite"),
};
const minSec = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`);

/** The narration, as it is meant to be read; the subtitles until Aichen records it. */
const NARRATION: Cue[] = [
  { start: 3.4, end: 8.2, text: "Hi, I'm Aichen Qian. Every week my friends and I have a game night," },
  { start: 8.2, end: 12.4, text: "and we'd played everything on the shelf." },
  { start: 12.4, end: 17.8, text: "So I built BoardDream: describe a game in one sentence, and play it together tonight." },
  { start: 18.2, end: 22.4, text: "Tonight we want a cafe game. I pick an idea," },
  { start: 22.4, end: 26.8, text: "set three to four players, and press Dream it up." },
  { start: 27.2, end: 33, text: "Muse Spark, Meta's model, designs the game: the street, the cards, how you win." },
  { start: 33, end: 39.5, text: "It picks tested mechanics from our library and writes the rules as real code." },
  { start: 39.5, end: 45.5, text: "Before anyone plays, bots run a thousand games," },
  { start: 45.5, end: 50.8, text: "and anything that breaks goes back to Muse Spark to fix." },
  { start: 51.2, end: 57, text: "About six minutes later, the game is ready." },
  { start: 57.2, end: 64.8, text: "If a friend can't make it, Muse Spark Open, Meta's open-weight model, takes the empty seat." },
  { start: 65.2, end: 70.6, text: "Every group has house rules. We ask for a change in plain words," },
  { start: 70.6, end: 78.8, text: "and it's rewritten and tested again, as version two." },
  { start: 79.2, end: 86.8, text: "Muse Image paints the board, and SAM 3.1 checks every painted tile sits on the real one." },
  { start: 87.2, end: 92.8, text: "Then I send my friends a link, and we play at one table." },
  { start: 93.2, end: 96.6, text: "Why build this? Game night is how we stay close," },
  { start: 96.6, end: 99.8, text: "and a new game keeps it fresh." },
  { start: 100.2, end: 104, text: "But testing your own idea takes weeks of paper prototypes." },
  { start: 104, end: 107.8, text: "BoardDream gives your table a game that has already been played a thousand times." },
  { start: 108.2, end: 114.8, text: "Four Meta models, each with a job: Muse Spark designs, Muse Spark Open plays, Muse Image paints, SAM 3.1 checks." },
  { start: 115.2, end: 118.6, text: "Everything you saw was built during this hackathon." },
  { start: 118.6, end: 121.8, text: "Try it at boarddream.pages.dev, and play something new with your friends tonight." },
];

/** The stretches where Aichen is on camera: the line is the picture there, not a subtitle. */
const ON_CAMERA: [number, number][] = [
  [3, 18],
  [93, 100],
  [115, 122],
];

/**
 * Aichen on camera. Until the take is recorded: the warm black ground, the line being said set
 * large in the middle, and Aichen's name in the lower left at the start.
 */
const OnCamera: React.FC<{ take: keyof typeof CAMERA; start: number; lead: number; named?: boolean }> = ({ take, start, lead, named }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - lead + start;
  const file = CAMERA[take];
  const cue = NARRATION.find((c) => t >= c.start && t < c.end);
  return (
    <AbsoluteFill>
      {file ? (
        <Video src={staticFile(file)} muted objectFit="cover" style={{ width: "100%", height: "100%" }} />
      ) : (
        <Night glow={C.teal}>
          <div style={{ position: "absolute", left: 72, top: 64 }}>
            <Eyebrow text="On camera · to be recorded" color={C.creamMuted} />
          </div>
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 220px" }}>
            {cue && (
              <Sequence key={cue.start} from={Math.round((cue.start - start + lead) * fps)} layout="none">
                <Rise text={cue.text} size={72} weight={400} style={{ textAlign: "center" }} stagger={0.045} />
              </Sequence>
            )}
          </AbsoluteFill>
        </Night>
      )}
      {named && <LowerThird label={BUILDER} text="built BoardDream at this hackathon" lead={lead} at={0.8} until={6.5} />}
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

const take = (src: string, from: number, opts: { rate?: number; zoom?: [number, number]; focus?: [[number, number], [number, number]] } = {}) =>
  function Take(lead: number) {
    return <Footage src={src} from={from} lead={lead} rate={opts.rate} zoom={opts.zoom} focus={opts.focus} />;
  };

const P = "footage/primer.mp4";
const A = "footage/after.mp4";

/** A sped-up stretch: plays `[from, to]` of a take in `seconds`. */
const fast = (from: number, to: number, seconds: number) => ({ from, rate: (to - from) / seconds });

const making = [fast(13, 118, 8), fast(118, 238, 8), fast(238, 352, 8)];
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
    then: T.fade(20),
  },
  { name: "Aichen: who and why", seconds: 15, render: (lead) => <OnCamera take="intro" start={3} lead={lead} named />, then: T.blur() },
  { name: "The idea", seconds: 9, render: take(P, 3, { zoom: [1.25, 1.4], focus: [[960, 330], [960, 560]] }), then: T.wipe() },
  {
    name: "Muse Spark designs",
    seconds: 8,
    render: take(P, making[0].from, { rate: making[0].rate, zoom: [1.25, 1.35], focus: [[820, 300], [800, 420]] }),
    then: T.blur(14),
  },
  {
    name: "Tested mechanics",
    seconds: 8,
    render: take(P, making[1].from, { rate: making[1].rate, zoom: [1.4, 1.5], focus: [[1460, 330], [1460, 400]] }),
    then: T.blur(14),
  },
  {
    name: "Rules as code, tested",
    seconds: 8,
    render: take(P, making[2].from, { rate: making[2].rate, zoom: [1.55, 1.65], focus: [[240, 520], [240, 620]] }),
    then: T.push(20, "from-right"),
  },
  // From the moment the new table is drawn (the app of the time redrew it blank for a second before).
  { name: "Ready", seconds: 4, render: take(P, 357.3, { rate: 1.05, zoom: [1.08, 1.18], focus: [[760, 520], [560, 600]] }), then: T.iris() },
  { name: "The table", seconds: 3, render: take(A, AFTER.table + 0.5, { zoom: [1.08, 1.18], focus: [[960, 470], [960, 500]] }), then: T.leak(30, 5) },
  { name: "Muse Spark Open", seconds: 7, render: take(A, AFTER.rivals + 2, { rate: 1.4, zoom: [1.05, 1.12], focus: [[960, 480], [960, 520]] }), then: T.push(20, "from-left") },
  { name: "A house rule", seconds: 6, render: take(A, AFTER.rules + 0.3, { rate: 1.3, zoom: [1.45, 1.65], focus: [[1640, 560], [1700, 640]] }), then: T.blur(16) },
  { name: "Rewritten and tested", seconds: 4, render: take(A, revising.from, { rate: revising.rate, zoom: [1.3, 1.4], focus: [[1500, 560], [1600, 600]] }), then: T.blur(16) },
  { name: "Version two", seconds: 4, render: take(A, AFTER.revised + 0.6, { rate: 1.2, zoom: [1.4, 1.5], focus: [[1640, 520], [1680, 600]] }), then: T.wipe(24, 80) },
  { name: "Painting", seconds: 4, render: take(A, painting.from, { rate: painting.rate, zoom: [1.15, 1.25], focus: [[900, 420], [1000, 440]] }), then: T.blur(16) },
  { name: "Painted", seconds: 4, render: take(A, AFTER.paintedTable + 0.4, { zoom: [1.25, 1.45], focus: [[700, 400], [760, 420]] }), then: T.push(20, "from-bottom") },
  { name: "Invite friends", seconds: 6, render: take(A, AFTER.invite - 1.2, { rate: 0.9, zoom: [1.3, 1.45], focus: [[960, 470], [960, 520]] }), then: T.leak(34, 9) },
  { name: "Aichen: why", seconds: 7, render: (lead) => <OnCamera take="why" start={93} lead={lead} />, then: T.blur() },
  { name: "Every game", seconds: 8, render: () => <CoverWall covers={COVERS} dim={0.45} />, then: T.wipe(26) },
  { name: "Four models", seconds: 7, render: () => <Models />, then: T.blur() },
  { name: "Aichen: close", seconds: 7, render: (lead) => <OnCamera take="close" start={115} lead={lead} />, then: T.fade(20) },
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
      <Sequence from={sec(27.4)} durationInFrames={sec(23.4)} layout="none">
        <SpeedBadge factor={14} real={minSec(352 - 13)} />
      </Sequence>
      <Sequence from={sec(71.3)} durationInFrames={sec(3.5)} layout="none">
        <SpeedBadge factor={Math.round(revising.rate)} real={minSec(AFTER.revised - AFTER.revise)} />
      </Sequence>
      <Sequence from={sec(79.3)} durationInFrames={sec(3.5)} layout="none">
        <SpeedBadge factor={Math.round(painting.rate)} real={minSec(AFTER.painted - AFTER.paint)} />
      </Sequence>
      <Subtitles cues={NARRATION} hide={ON_CAMERA} />
    </AbsoluteFill>
  );
};
