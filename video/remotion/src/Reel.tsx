import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CoverWall, Eyebrow, Footage, LowerThird, Night, Rise, T, Wordmark, clamp, ease } from "./fx";
import { Timeline, sceneSeconds, type Scene } from "./timeline";
import { C, DISPLAY, HEIGHT, UI } from "./theme";

/**
 * Part 1, after Figma's launch reels: the real app, every shot filling the frame with the camera
 * moving slowly over it, cards in warm black between, a handover at every cut, and the Meta model
 * at work named in the lower left. Music, no voice.
 */

export const COVERS = [
  "tidehearth-mw0zl535.webp",
  "cloudwaft-harbor-mw0zp3es.webp",
  "saffron-wake-mw0415eq.webp",
  "fogfall-lanterns-mw0zerzb.webp",
  "copper-grind-mw166meu.webp",
  "lantern-isles.webp",
  "highsail.webp",
  "mossbrae-mw0zc2d4.webp",
  "sunlit-pantheon-mw058d57.webp",
  "wildmere.webp",
  "rustspire-mw047w4k.webp",
  "fenlight.webp",
  "hollow-manifest-mw04cfcn.webp",
];

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
      {side("footage/friends-host.mp4", 0, 4.8, 16.2, "Aichen's screen", C.rust)}
      {side("footage/friends-friend.mp4", 962, 5.8, 16.2, "Mira's screen", C.teal)}
      <div style={{ position: "absolute", left: 958, top: 0, width: 4, height: HEIGHT, background: `linear-gradient(${C.gold}, ${C.goldSoft}, ${C.gold})` }} />
      <LowerThird label="Game night" text="Invite friends with one link" lead={lead} at={0.5} until={5.2} />
    </AbsoluteFill>
  );
};

/** A shot of the app with what is at work named in the lower left. */
const shot = (
  src: string,
  from: number,
  opts: { rate?: number; zoom?: [number, number]; focus?: [[number, number], [number, number]]; label?: string; text?: string; at?: number; until?: number },
) =>
  function Shot(lead: number) {
    return (
      <AbsoluteFill>
        <Footage src={src} from={from} lead={lead} rate={opts.rate} zoom={opts.zoom} focus={opts.focus} />
        {opts.label && <LowerThird label={opts.label} text={opts.text ?? ""} lead={lead} at={opts.at ?? 0.5} until={opts.until ?? 99} />}
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
    then: T.leak(34, 3),
  },
  {
    name: "The question",
    seconds: 4,
    render: shot("footage/home-2x.mp4", 0.6, { zoom: [1.55, 1.75], focus: [[960, 330], [960, 430]] }),
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
    render: shot("footage/primer.mp4", 110, {
      rate: 24,
      zoom: [1.35, 1.5],
      focus: [
        [820, 300],
        [1460, 330],
      ],
      label: "Muse Spark",
      text: "designs the game and writes its rules as code",
      until: 4.4,
    }),
    then: T.blur(),
  },
  { name: "A thousand games", seconds: 3.2, render: () => <Thousand />, then: T.push(20, "from-right") },
  {
    name: "Playtest",
    seconds: 3.4,
    render: shot("footage/primer.mp4", 300, {
      rate: 8,
      zoom: [1.55, 1.7],
      focus: [
        [220, 640],
        [230, 760],
      ],
      label: "Tested, then fixed",
      text: "anything that breaks goes back to Muse Spark",
      until: 3.3,
    }),
    then: T.iris(),
  },
  { name: "Friends", seconds: 5.6, render: (lead) => <Friends lead={lead} />, then: T.leak(34, 7) },
  {
    name: "The table",
    seconds: 4.6,
    render: shot("footage/table-2x.mp4", 1.2, {
      zoom: [1.6, 1.85],
      focus: [
        [600, 380],
        [560, 430],
      ],
    }),
    then: T.blur(),
  },
  {
    name: "Cards",
    seconds: 4,
    render: shot("footage/cards-2x.mp4", 6.5, {
      zoom: [1.45, 1.6],
      focus: [
        [960, 760],
        [900, 800],
      ],
      label: "Engine building",
      text: "cards that set each other off",
    }),
    then: T.wipe(24, 80),
  },
  {
    name: "Rivals",
    seconds: 4.6,
    render: shot("footage/rivals.mp4", 11, {
      rate: 1.6,
      zoom: [1.06, 1.16],
      focus: [
        [960, 460],
        [960, 520],
      ],
      label: "Muse Spark Open",
      text: "takes the empty seat, and talks",
    }),
    then: T.push(20, "from-left"),
  },
  {
    name: "House rules",
    seconds: 3.6,
    render: shot("footage/rule-2x.mp4", 2.2, {
      rate: 1.3,
      zoom: [1.9, 2.1],
      focus: [
        [1700, 600],
        [1720, 630],
      ],
      label: "House rules",
      text: "changed in plain words, tested again",
    }),
    then: T.blur(),
  },
  {
    name: "Painted",
    seconds: 3.6,
    render: shot("footage/painted-2x.mp4", 2.2, {
      zoom: [1.75, 1.95],
      focus: [
        [520, 330],
        [520, 350],
      ],
      label: "Muse Image · SAM 3.1",
      text: "paints the board, checks every tile",
    }),
    then: T.leak(30, 11),
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
    then: T.fade(18),
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
