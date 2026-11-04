// A region of real screen footage (2560 x 1440, the page laid out at 1920 x 1080 CSS px), shown at
// `scale` per CSS px: the recording itself, cut to one part of the page.
import React from "react";
import { OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import type { Region } from "./Crop";

export const VideoCrop: React.FC<{
  clip: string; // name in public/footage/clips
  from: number; // seconds into the clip at the Sequence's start
  region: Region;
  scale: number;
  rate?: number;
  style?: React.CSSProperties;
}> = ({ clip, from, region, scale, rate = 1, style }) => {
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", width: region.w * scale, height: region.h * scale, overflow: "hidden", ...style }}>
      <OffthreadVideo
        src={staticFile(`footage/clips/${clip}.mp4`)}
        muted
        trimBefore={Math.round(from * fps)}
        playbackRate={rate}
        style={{ position: "absolute", left: -region.x * scale, top: -region.y * scale, width: 1920 * scale, height: 1080 * scale, maxWidth: "none" }}
      />
    </div>
  );
};
