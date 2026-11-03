import React from "react";
import { AbsoluteFill, Img, Sequence, Series, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import cloudwaft from "../../../apps/web/public/covers/cloudwaft-harbor-mw0zp3es.webp";
import fogfall from "../../../apps/web/public/covers/fogfall-lanterns-mw0zerzb.webp";
import saffron from "../../../apps/web/public/covers/saffron-wake-mw0415eq.webp";
import tidehearth from "../../../apps/web/public/covers/tidehearth-mw0zl535.webp";
import { MochiGuide } from "./Mochi";
import { Backdrop, BrandMark, Headline, Shot, onShot } from "./parts";
import { C, DISPLAY, HEIGHT, UI, WIDTH } from "./theme";

/**
 * Part 1, after Figma's launch reels: about 50 seconds of the real app in close-ups on the
 * storybook paper, music and no voice, the mochi hopping to each thing worth a look and naming the
 * Meta model at work.
 */
export const REEL_SECONDS = 50;

const Open: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const word = spring({ frame: frame - 0.45 * fps, fps, config: { damping: 16, stiffness: 120 } });
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 36 }}>
        <div style={{ scale: String(mark), rotate: `${(1 - mark) * -40}deg` }}>
          <BrandMark size={190} />
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: 150, fontWeight: 650, color: C.ink, opacity: word, translate: `${(1 - word) * 30}px 0px` }}>BoardDream</div>
      </AbsoluteFill>
      <MochiGuide enter={[2080, 760]} stops={[{ at: 1.1, x: 1745, y: 640, happy: true }]} />
    </AbsoluteFill>
  );
};

const covers = [tidehearth, cloudwaft, saffron, fogfall];

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Backdrop color={C.paper2} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 150, gap: 22 }}>
        <Headline text="A new game for your table," size={104} />
        <Headline text="every night." size={104} delay={0.25} italic color={C.rust} />
      </AbsoluteFill>
      {covers.map((cover, i) => {
        const p = spring({ frame: frame - (0.35 + i * 0.12) * fps, fps, config: { damping: 15, stiffness: 120 } });
        return (
          <Img
            key={i}
            src={cover}
            style={{
              position: "absolute",
              left: 150 + i * 420,
              top: 560,
              width: 380,
              height: 253,
              objectFit: "cover",
              borderRadius: 18,
              border: `4px solid ${C.ink}`,
              boxShadow: `0 8px 0 ${C.ink}`,
              rotate: `${[-4, 2.5, -2, 3.5][i]}deg`,
              translate: `0px ${(1 - p) * 300 + interpolate(frame, [0, 3 * fps], [0, -18])}px`,
              opacity: p,
            }}
          />
        );
      })}
      <MochiGuide stops={[{ at: 0.2, x: 1650, y: 560 }, { at: 1.4, x: 1720, y: 545, happy: true }]} />
    </AbsoluteFill>
  );
};

/** A close-up with the guide in it; the guide's stops are footage points, placed on the shot. */
const CloseUp: React.FC<{
  src: string;
  from: number;
  rate?: number;
  zoom: number;
  zoomTo?: number;
  focus: [number, number];
  seconds: number;
  color?: string;
  guide?: { at: number; point: [number, number]; say?: string; happy?: boolean; sayFor?: number }[];
  enter?: [number, number];
}> = ({ src, from, rate, zoom, zoomTo, focus, seconds, color, guide = [], enter }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Backdrop color={color} />
      <Shot src={src} from={from} rate={rate} zoom={zoom} zoomTo={zoomTo} focus={focus} durationInFrames={Math.round(seconds * fps)} />
      {guide.length > 0 && (
        <MochiGuide
          enter={enter}
          stops={guide.map(({ at, point, say, happy, sayFor }) => {
            const [x, y] = onShot(point, focus, zoom);
            return { at, x, y, say, happy, sayFor };
          })}
        />
      )}
    </AbsoluteFill>
  );
};

/** Aichen opens a table, Mira joins by the link; then both are dealt in. */
const Friends: React.FC = () => {
  const { fps } = useVideoConfig();
  const card = (x: number) => ({ width: 880, height: 495, x, y: 250 });
  // The lobby close, its card filling the window; then the whole table.
  const half = (src: string, x: number, lobbyFrom: number, tableFrom: number, name: string, color: string) => (
    <>
      <Sequence durationInFrames={Math.round(4 * fps)} layout="none">
        <Shot src={src} from={lobbyFrom} zoom={0.86} focus={[960, 520]} card={card(x)} durationInFrames={Math.round(4 * fps)} />
      </Sequence>
      <Sequence from={Math.round(4 * fps)} layout="none">
        <Shot src={src} from={tableFrom} zoom={0.5} focus={[960, 560]} card={card(x)} durationInFrames={Math.round(4 * fps)} />
      </Sequence>
      <div style={{ position: "absolute", left: x + 24, top: 180, padding: "8px 22px", borderRadius: 999, background: color, color: "white", fontFamily: UI, fontWeight: 700, fontSize: 32, border: `3px solid ${C.ink}`, boxShadow: `0 4px 0 ${C.ink}` }}>{name}</div>
    </>
  );
  return (
    <AbsoluteFill>
      <Backdrop color="#e6dcc6" />
      {half("footage/friends-host.mp4", 60, 2.6, 22.5, "Aichen", C.rust)}
      {half("footage/friends-friend.mp4", 980, 5.6, 23.4, "Mira", C.teal)}
      <MochiGuide stops={[{ at: 0.6, x: 960, y: 960, say: "Invite your friends with one link", sayFor: 3.2 }, { at: 4.4, x: 960, y: 960, happy: true }]} enter={[960, 1300]} />
    </AbsoluteFill>
  );
};

const Close: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 18 }}>
      <BrandMark size={120} />
      <Headline text="Dream it up. Play it tonight." size={96} delay={0.1} />
    </AbsoluteFill>
    <MochiGuide stops={[{ at: 0.3, x: 1730, y: 640, happy: true }]} enter={[1730, 1200]} />
  </AbsoluteFill>
);

export const Reel: React.FC = () => {
  const { fps } = useVideoConfig();
  const sec = (s: number) => Math.round(s * fps);
  return (
    <AbsoluteFill style={{ background: C.paper, width: WIDTH, height: HEIGHT }}>
      <Series>
        <Series.Sequence durationInFrames={sec(3)} name="Open">
          <Open />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(4)} name="The question">
          <CloseUp src="footage/primer.mp4" from={3} rate={1.5} zoom={1.55} focus={[960, 430]} seconds={4} guide={[{ at: 0.3, point: [610, 590] }, { at: 2.6, point: [610, 590], happy: true }]} enter={[-100, 900]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(3)} name="Title">
          <Title />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(6.5)} name="Muse Spark designs">
          <CloseUp
            src="footage/primer.mp4"
            from={12.4}
            rate={21}
            zoom={1.12}
            focus={[1000, 400]}
            seconds={6.5}
            color="#dfe9e4"
            enter={[560, 1250]}
            guide={[{ at: 0.6, point: [1270, 520], say: "Muse Spark designs the game and writes its rules as code" }]}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(4.5)} name="A thousand playtests">
          <CloseUp src="footage/primer.mp4" from={340} rate={3.6} zoom={1.02} focus={[960, 470]} seconds={4.5} color="#ece2cf" guide={[{ at: 0.3, point: [1500, 700], say: "Bots play 1,000 games before you do" }, { at: 3.6, point: [1500, 700], happy: true }]} enter={[2100, 900]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(8)} name="Friends">
          <Friends />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(6.5)} name="The table">
          <CloseUp src="footage/table.mp4" from={2} zoom={1.45} zoomTo={1.7} focus={[620, 430]} seconds={6.5} color="#e9dcc0" guide={[{ at: 0.5, point: [330, 690], happy: true }]} enter={[-120, 1000]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(6)} name="Rivals that talk">
          <CloseUp src="footage/rivals.mp4" from={10} rate={1.8} zoom={1.0} focus={[960, 540]} seconds={6} color="#e3e6ec" guide={[{ at: 0.4, point: [1480, 880], say: "A friend can't make it? Muse Spark Open takes the seat, and talks" }]} enter={[2100, 900]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(3.5)} name="House rules">
          <CloseUp src="footage/primer.mp4" from={424.5} rate={2.6} zoom={1.8} focus={[1745, 560]} seconds={3.5} color="#f0e0cf" guide={[{ at: 0.35, point: [1600, 760], say: "Your house rules, in plain words" }]} enter={[1300, 1250]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(3)} name="Painted">
          <CloseUp src="footage/painted.mp4" from={1} rate={2} zoom={1.6} focus={[620, 430]} seconds={3} color="#e2e8d8" guide={[{ at: 0.3, point: [880, 640], say: "Muse Image paints. SAM 3.1 checks." }]} enter={[2000, 900]} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(2)} name="Close">
          <Close />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

