import React from "react";
import { Composition } from "remotion";
import { Promo } from "./Promo";
import { TOTAL } from "./timeline";
import { FPS } from "./lib/time";

export const RemotionRoot: React.FC = () => (
  <Composition id="Promo" component={Promo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} defaultProps={{ bgm: true }} />
);
