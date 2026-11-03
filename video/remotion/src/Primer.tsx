import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { MochiGuide, type Stop } from "./Mochi";
import { Backdrop, BrandMark, CameraBubble, Captions, Outro, SpeedBadge, type Cue } from "./parts";
import { C, DISPLAY, HEIGHT, UI, WIDTH } from "./theme";

/**
 * Part 2, after Linear's primers: a title card, then one continuous take of the app (the take that
 * made Copper Grind for real), the builder's camera in a round frame, the narration as captions,
 * and the mochi hopping to whatever is being talked about. Long waits play fast, with a badge.
 */
export const PRIMER_SECONDS = 126;
export const BUILDER = "Aichen Qian";

/** The take on screen: a window on the paper, room left below for the captions. */
const SCREEN = { x: 40, y: 26, scale: 0.86 };
const onScreen = ([x, y]: [number, number]): [number, number] => [Math.round(SCREEN.x + x * SCREEN.scale), Math.round(SCREEN.y + y * SCREEN.scale)];

/** The take, cut into pieces each played at its own speed: [name, start on screen (s), length (s), start in the take (s), speed]. */
const PIECES: [string, number, number, number, number][] = [
  ["Intro", 3, 15, 0, 0.25],
  ["The idea", 18, 9, 4, 1],
  ["Making the game", 27, 24, 13, 14.125],
  ["Ready", 51, 6, 352, 2],
  ["Muse Spark Open", 57, 8, 381.5, 3],
  ["A house rule", 65, 6, 424, 1.5],
  ["Revising", 71, 4, 433, 18],
  ["Version two", 75, 4, 507.5, 1.25],
  ["Painting", 79, 4, 516.6, 14.5],
  ["Painted", 83, 4, 575, 3.75],
  ["Invite friends", 87, 6, 590.4, 0.55],
  ["The games", 93, 22, 595.9, 0.24],
  ["Home", 115, 8, 602.8, 1],
];

const BADGES: [number, number, number, string][] = [
  [27, 24, 14, "5 min 44 s"],
  [71, 4, 18, "1 min 13 s"],
  [79, 4, 15, "58 s"],
];

/** The narration, as the captions show it until the builder records it. */
const NARRATION: Cue[] = [
  { start: 3.3, end: 8.3, text: "Hi, I'm Aichen Qian. Every week my friends and I have a game night," },
  { start: 8.3, end: 12.6, text: "and we'd played everything on the shelf." },
  { start: 12.6, end: 18, text: "So I built BoardDream: describe a game in one sentence, and play it together tonight." },
  { start: 18.2, end: 22.5, text: "Tonight we want a cafe game. I pick an idea," },
  { start: 22.5, end: 27, text: "set three to four players, and press Dream it up." },
  { start: 27.2, end: 33, text: "Muse Spark, Meta's model, designs the game: the street, the cards, how you win." },
  { start: 33, end: 39.5, text: "It picks tested mechanics from our library and writes the rules as real code." },
  { start: 39.5, end: 45.5, text: "Before anyone plays, bots run a thousand games," },
  { start: 45.5, end: 51, text: "and anything that breaks goes back to Muse Spark to fix." },
  { start: 51.2, end: 57, text: "About six minutes later, the game is ready." },
  { start: 57.2, end: 65, text: "If a friend can't make it, Muse Spark Open, Meta's open-weight model, takes the empty seat." },
  { start: 65.2, end: 70.5, text: "Every group has house rules. We ask for a change in plain words," },
  { start: 70.5, end: 79, text: "and it's rewritten and tested again, as version two." },
  { start: 79.2, end: 87, text: "Muse Image paints the board, and SAM 3.1 checks every painted tile sits on the real one." },
  { start: 87.2, end: 93, text: "Then I send my friends a link, and we play at one table." },
  { start: 93.2, end: 98.5, text: "Why build this? Game night is how we stay close, and a new game keeps it fresh." },
  { start: 98.5, end: 103.5, text: "But testing your own idea takes weeks of paper prototypes." },
  { start: 103.5, end: 108.5, text: "BoardDream gives your table a game that has already been played a thousand times." },
  { start: 108.5, end: 115, text: "Four Meta models, each with a job: Muse Spark designs, Muse Spark Open plays, Muse Image paints, SAM 3.1 checks." },
  { start: 115.2, end: 119, text: "Everything you saw was built during this hackathon." },
  { start: 119, end: 123, text: "Try it at boarddream.pages.dev, and play something new with your friends tonight." },
];

/** Where the mochi goes, in the take's own pixels, at times on screen. */
const GUIDE: (Omit<Stop, "x" | "y"> & { point: [number, number] })[] = [
  { at: 3.8, point: [1640, 300] },
  { at: 18.6, point: [640, 600] },
  { at: 24.4, point: [1440, 390] },
  { at: 26.8, point: [1440, 390], happy: true },
  { at: 28.2, point: [1200, 240] },
  { at: 36, point: [1520, 250] },
  { at: 43.6, point: [330, 470] },
  { at: 49.4, point: [430, 1010], happy: true },
  { at: 52, point: [330, 1000] },
  { at: 57.6, point: [700, 1010] },
  { at: 65.6, point: [1555, 700] },
  { at: 75.6, point: [620, 120], happy: true },
  { at: 79.6, point: [1555, 430] },
  { at: 84.2, point: [1180, 470], happy: true },
  { at: 87.8, point: [1300, 760] },
  { at: 94, point: [520, 560] },
  { at: 101, point: [1020, 560] },
  { at: 108, point: [1480, 560] },
  { at: 115.6, point: [1640, 300], happy: true },
];

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center", gap: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26, opacity: p, translate: `0px ${(1 - p) * 30}px` }}>
        <BrandMark size={96} />
        <div style={{ fontFamily: DISPLAY, fontSize: 96, fontWeight: 650, color: C.paper }}>How BoardDream works</div>
      </div>
      <div style={{ fontFamily: UI, fontSize: 44, color: "#d9c9ad", opacity: p }}>A primer with {BUILDER}, who built it</div>
      <MochiGuide enter={[2050, 760]} size={110} stops={[{ at: 0.9, x: 1500, y: 700, happy: true }]} />
    </AbsoluteFill>
  );
};

export const Primer: React.FC = () => {
  const { fps } = useVideoConfig();
  const sec = (s: number) => Math.round(s * fps);
  return (
    <AbsoluteFill style={{ width: WIDTH, height: HEIGHT }}>
      <Backdrop color="#e8dcc4" />
      {/* The take, in a window. */}
      <div
        style={{
          position: "absolute",
          left: SCREEN.x,
          top: SCREEN.y,
          width: WIDTH * SCREEN.scale,
          height: HEIGHT * SCREEN.scale,
          overflow: "hidden",
          borderRadius: 22,
          border: `4px solid ${C.ink}`,
          boxShadow: `0 8px 0 ${C.ink}`,
          background: C.paper,
        }}
      >
        {PIECES.map(([name, start, length, from, rate]) => (
          <Sequence key={name} name={name} from={sec(start)} durationInFrames={sec(length)} layout="none">
            <div style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT, transformOrigin: "0 0", scale: String(SCREEN.scale) }}>
              <Video src={staticFile("footage/primer.mp4")} trimBefore={Math.round(from * fps)} playbackRate={rate} muted style={{ width: WIDTH, height: HEIGHT }} />
            </div>
          </Sequence>
        ))}
      </div>
      {BADGES.map(([start, length, factor, real]) => (
        <Sequence key={start} from={sec(start)} durationInFrames={sec(length)} layout="none">
          <SpeedBadge factor={factor} real={real} />
        </Sequence>
      ))}
      <Captions cues={NARRATION} />
      <Sequence from={sec(3)} durationInFrames={sec(120)} layout="none">
        <CameraBubble name={BUILDER} />
      </Sequence>
      <MochiGuide
        size={104}
        enter={[2050, 330]}
        stops={GUIDE.map(({ point, ...rest }) => {
          const [x, y] = onScreen(point);
          return { ...rest, x, y };
        })}
      />
      <Sequence durationInFrames={sec(3)} name="Title">
        <Title />
      </Sequence>
      <Sequence from={sec(123)} durationInFrames={sec(3)} name="Outro">
        <Outro line="Describe a game. Play it with your friends tonight." />
      </Sequence>
    </AbsoluteFill>
  );
};
