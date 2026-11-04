import React from "react";
import { Composition, Still } from "remotion";
import { Promo } from "./Promo";
import { Thumbnail } from "./Thumbnail";
import { RedCover } from "./RedCover";
import { TOTAL } from "./timeline";
import { FPS } from "./lib/time";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Promo" component={Promo} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} defaultProps={{ bgm: true }} />
    <Still id="Thumbnail" component={Thumbnail} width={1920} height={1080} />
    <Still id="RedCover" component={RedCover} width={1080} height={1440} />
  </>
);
