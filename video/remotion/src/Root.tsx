import React from "react";
import { AbsoluteFill, Composition, Sequence } from "remotion";
import { PRIMER_SECONDS, Primer } from "./Primer";
import { REEL_SECONDS, Reel } from "./Reel";
import { FPS, HEIGHT, WIDTH } from "./theme";

/** The whole demo video: the reel, then the primer. */
const DemoVideo: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={REEL_SECONDS * FPS} name="Part 1: BoardDream in motion">
      <Reel />
    </Sequence>
    <Sequence from={REEL_SECONDS * FPS} durationInFrames={PRIMER_SECONDS * FPS} name="Part 2: a primer with the builder">
      <Primer />
    </Sequence>
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="DemoVideo" component={DemoVideo} durationInFrames={(REEL_SECONDS + PRIMER_SECONDS) * FPS} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Reel" component={Reel} durationInFrames={REEL_SECONDS * FPS} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Primer" component={Primer} durationInFrames={PRIMER_SECONDS * FPS} fps={FPS} width={WIDTH} height={HEIGHT} />
  </>
);
