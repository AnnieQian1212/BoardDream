import React from "react";
import { AbsoluteFill, Composition, Sequence } from "remotion";
import { CONCEPT_SECONDS, Concept } from "./Concept";
import { TwoWays } from "./Flows";
import { PRIMER_SECONDS, Primer } from "./Primer";
import { REEL_SECONDS, Reel } from "./Reel";
import { SHORT_SECONDS, Short } from "./Short";
import { PROMO_SECONDS, Promo } from "./Promo";
import { FPS, HEIGHT, WIDTH } from "./theme";

const reel = Math.round(CONCEPT_SECONDS * FPS);
const primer = Math.round(PRIMER_SECONDS * FPS);

/** The whole demo video: the reel, then the primer. */
const DemoVideo: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={reel} name="Part 1: BoardDream, a concept film">
      <Concept />
    </Sequence>
    <Sequence from={reel} durationInFrames={primer} name="Part 2: a primer with the builder">
      <Primer />
    </Sequence>
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Promo" component={Promo} durationInFrames={Math.round(PROMO_SECONDS * FPS)} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Short" component={Short} durationInFrames={Math.round(SHORT_SECONDS * FPS)} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="DemoVideo" component={DemoVideo} durationInFrames={reel + primer} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Concept" component={Concept} durationInFrames={reel} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Reel" component={Reel} durationInFrames={Math.round(REEL_SECONDS * FPS)} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Primer" component={Primer} durationInFrames={primer} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="TwoWays" component={TwoWays} defaultProps={{ lead: 0 }} durationInFrames={Math.round(8 * FPS)} fps={FPS} width={WIDTH} height={HEIGHT} />
  </>
);
