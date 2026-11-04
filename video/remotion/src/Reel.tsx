import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CoverWall, Eyebrow, Footage, LowerThird, Night, Rise, T, Wordmark, clamp, ease, type Move } from "./fx";
import { Timeline, sceneSeconds, type Scene } from "./timeline";
import { C, DISPLAY, HEIGHT, UI } from "./theme";
import making from "../public/footage/making.json";
import after from "../public/footage/after.json";
import host from "../public/footage/friends-host.json";
import guest from "../public/footage/friends-friend.json";

/**
 * Part 1, after Figma's launch reels: the real app, every shot filling the frame with the camera
 * pushing in and whipping across it, cards in warm black between, a handover at every cut, and the
 * Meta model at work named in the lower left. Music, no voice.
 */

export const COVERS = [
  "tidehearth-mw0zl535.webp",
  "cloudwaft-harbor-mw0zp3es.webp",
  "saffron-wake-mw0415eq.webp",
  "fogfall-lanterns-mw0zerzb.webp",
  "basalt-kin-mw1bm4fr.webp",
  "lantern-isles.webp",
  "highsail.webp",
  "mossbrae-mw0zc2d4.webp",
  "sunlit-pantheon-mw058d57.webp",
  "wildmere.webp",
  "rustspire-mw047w4k.webp",
  "fenlight.webp",
  "hollow-manifest-mw04cfcn.webp",
];

/** When things happen in the takes Part 1 borrows from (video/record/takes.mjs marks them). */
const at = (take: { marks: { label: string; t: number }[] }, label: string, nth = 0) => {
  const found = take.marks.filter((m) => m.label === label)[nth];
  if (!found) throw new Error(`no mark "${label}" #${nth}`);
  return found.t;
};

/** "1,000" counting up, and what it counts. */
const Thousand: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.round(1000 * ease(interpolate(frame / fps, [0.3, 1.9], [0, 1], clamp)));
  return (
    <Night glow={C.teal}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 18 }}>
        <Eyebrow text="Before you play" delay={0.1} />
        <div style={{ fontFamily: DISPLAY, fontSize: 230, fontWeight: 500, color: C.cream, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{n.toLocaleString("en-US")}</div>
        <Rise text="games, played by bots, on every new game" size={52} delay={0.6} color={C.creamMuted} weight={400} italic />
      </AbsoluteFill>
    </Night>
  );
};

/** Aichen's table and Mira's, side by side: the lobby as Mira joins by the link, then both dealt in. */
const Friends: React.FC<{ lead: number }> = ({ lead }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps - lead;
  const swap = 2.6;
  const box = { width: 958, height: HEIGHT };
  const side = (src: string, left: number, lobby: number, table: number, name: string, color: string) => (
    <div style={{ position: "absolute", left, top: 0, width: box.width, height: box.height, overflow: "hidden" }}>
      <Sequence durationInFrames={Math.round((lead + swap + 0.3) * fps)} layout="none">
        <Footage src={src} from={lobby} lead={lead} zoom={[1.05, 1.12]} focus={[[960, 480], [960, 470]]} box={box} />
      </Sequence>
      <Sequence from={Math.round((lead + swap) * fps)} layout="none">
        <div style={{ position: "absolute", inset: 0, opacity: ease(Math.min(1, Math.max(0, (t - swap) / 0.3))) }}>
          <Footage src={src} from={table} lead={0} zoom={[1, 1.08]} focus={[[960, 520], [960, 560]]} box={box} />
        </div>
      </Sequence>
      <div style={{ position: "absolute", left: 36, top: 36, display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderRadius: 999, background: "rgba(18,13,10,0.78)", color: C.cream, fontFamily: UI, fontSize: 26, fontWeight: 600 }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: color }} />
        {name}
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {/* Each screen from just before Mira joins, then from just after both are dealt in. */}
      {side("footage/friends-host.mp4", 0, at(host, "joined") - 1.2, at(host, "dealt") + 1.5, "Aichen's screen", C.rust)}
      {side("footage/friends-friend.mp4", 962, at(guest, "joined") - 0.2, at(guest, "dealt") + 1.5, "Mira's screen", C.teal)}
      <div style={{ position: "absolute", left: 958, top: 0, width: 4, height: HEIGHT, background: `linear-gradient(${C.gold}, ${C.goldSoft}, ${C.gold})` }} />
      <LowerThird label="Game night" text="Invite friends with one link" lead={lead} at={0.5} until={5.2} />
    </AbsoluteFill>
  );
};

/** A shot of the app with what is at work named in the lower left. */
const shot = (src: string, from: number, opts: { rate?: number; camera: Move[]; label?: string; text?: string; at?: number; until?: number; high?: boolean }) =>
  function Shot(lead: number) {
    return (
      <AbsoluteFill>
        <Footage src={src} from={from} lead={lead} rate={opts.rate} camera={opts.camera} />
        {opts.label && <LowerThird label={opts.label} text={opts.text ?? ""} lead={lead} at={opts.at ?? 0.5} until={opts.until ?? 99} high={opts.high} />}
      </AbsoluteFill>
    );
  };

const SCENES: Scene[] = [
  {
    name: "Open",
    seconds: 3,
    render: () => (
      <Night>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Wordmark size={132} delay={0.2} />
        </AbsoluteFill>
      </Night>
    ),
    then: T.leak(1.13, 3),
  },
  {
    name: "The question",
    seconds: 4,
    render: shot("footage/making.mp4", 0.6, {
      rate: 1.3,
      camera: [
        { at: 0, zoom: 1.0, focus: [960, 540] },
        { at: 0.25, zoom: 1.5, focus: [960, 310] },
      ],
    }),
    then: T.blur(),
  },
  {
    name: "Title",
    seconds: 3,
    render: () => (
      <Night>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Eyebrow text="Describe it. Play it." delay={0.05} />
          <Rise text="A new game for your table," size={110} delay={0.2} />
          <Rise text="every night." size={110} delay={0.5} italic color={C.goldSoft} />
        </AbsoluteFill>
      </Night>
    ),
    then: T.wipe(),
  },
  {
    name: "Muse Spark designs",
    seconds: 4.6,
    render: shot("footage/making.mp4", at(making, "dream") + 6, {
      rate: 24,
      camera: [
        { at: 0, zoom: 1.15, focus: [960, 400] },
        { at: 0.3, zoom: 1.5, focus: [800, 260] },
        { at: 2.4, zoom: 1.45, focus: [1560, 320], over: 0.7 },
      ],
      label: "Muse Spark",
      text: "designs the game and writes its rules as code",
      until: 4.4,
    }),
    then: T.blur(),
  },
  { name: "A thousand games", seconds: 3.2, render: () => <Thousand />, then: T.push(0.67, "from-right") },
  {
    name: "Playtest",
    seconds: 3.4,
    render: shot("footage/making.mp4", at(making, "ready") - 13, {
      rate: 4,
      camera: [
        { at: 0, zoom: 1.2, focus: [400, 520] },
        { at: 0.3, zoom: 1.5, focus: [270, 560] },
      ],
      label: "Tested, then fixed",
      text: "anything that breaks goes back to Muse Spark",
      until: 3.3,
    }),
    then: T.push(0.6, "from-bottom"),
  },
  {
    name: "Mochi",
    seconds: 2.6,
    render: shot("footage/making.mp4", at(making, "mochi", 2) + 1.2, {
      rate: 1.5,
      camera: [{ at: 0, zoom: 1.5, focus: [760, 985] }],
      label: "While it's made",
      text: "a little mochi game to pass the wait",
      at: 0.2,
      until: 2.5,
      high: true,
    }),
    then: T.iris(),
  },
  { name: "Friends", seconds: 5.6, render: (lead) => <Friends lead={lead} />, then: T.leak(1.13, 7) },
  {
    name: "The table",
    seconds: 4.6,
    render: shot("footage/table.mp4", 1.2, {
      camera: [
        { at: 0, zoom: 1.05, focus: [960, 540] },
        { at: 0.3, zoom: 1.5, focus: [640, 360] },
        { at: 2.5, zoom: 1.5, focus: [1260, 420], over: 0.75 },
      ],
    }),
    then: T.blur(),
  },
  {
    name: "Cards",
    seconds: 4,
    render: shot("footage/cards.mp4", 6.5, {
      camera: [
        { at: 0, zoom: 1.1, focus: [960, 620] },
        { at: 0.35, zoom: 1.5, focus: [940, 780] },
      ],
      label: "Engine building",
      text: "cards that set each other off",
    }),
    then: T.wipe(0.8, 80),
  },
  {
    name: "Rivals",
    seconds: 4.6,
    render: shot("footage/rivals.mp4", 11, {
      rate: 1.6,
      camera: [
        { at: 0, zoom: 1.0, focus: [960, 540] },
        { at: 1.6, zoom: 1.3, focus: [960, 500] },
      ],
      label: "Muse Spark Open",
      text: "takes the empty seat, and talks",
    }),
    then: T.push(0.67, "from-left"),
  },
  {
    name: "House rules",
    seconds: 3.6,
    render: shot("footage/after.mp4", at(after, "rules") + 0.6, {
      rate: 1.4,
      camera: [
        { at: 0, zoom: 1.2, focus: [1400, 540] },
        { at: 0.3, zoom: 1.5, focus: [1660, 560] },
      ],
      label: "House rules",
      text: "changed in plain words, tested again",
    }),
    then: T.blur(),
  },
  {
    name: "Painted",
    seconds: 3.6,
    render: shot("footage/painted.mp4", 2.2, {
      camera: [
        { at: 0, zoom: 1.1, focus: [700, 420] },
        { at: 0.3, zoom: 1.5, focus: [540, 340] },
      ],
      label: "Muse Image · SAM 3.1",
      text: "paints the board, checks every tile",
    }),
    then: T.leak(1, 11),
  },
  {
    name: "Every game",
    seconds: 3,
    render: () => (
      <AbsoluteFill>
        <CoverWall covers={COVERS} dim={0.55} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Rise text="Every game, a world of its own." size={96} delay={0.2} />
        </AbsoluteFill>
      </AbsoluteFill>
    ),
    then: T.fade(0.6),
  },
  {
    name: "End",
    seconds: 2.8,
    render: () => (
      <Night>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34 }}>
          <Wordmark size={96} />
          <Rise text="Dream it up. Play it tonight." size={64} delay={0.35} italic color={C.goldSoft} weight={400} />
        </AbsoluteFill>
      </Night>
    ),
  },
];

export const REEL_SECONDS = sceneSeconds(SCENES);

export const Reel: React.FC = () => <Timeline scenes={SCENES} />;
