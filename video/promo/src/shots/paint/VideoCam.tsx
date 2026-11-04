// The page camera (lib/PageCam) over real screen footage instead of a still: the recording
// (2560 x 1440, the page laid out at 1920 x 1080 CSS) is drawn at page size and framed by the same
// keyed 2.5D camera, magnified through CSS zoom so it is sampled from the full-size frames.
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import { camAt, type CamKey } from "../../lib/PageCam";
import { useSec } from "../../lib/time";

export const VideoCam: React.FC<{
  clip: string; // name in public/footage/clips
  from: number; // seconds into the clip at the Sequence's start
  rate?: number;
  keys: CamKey[];
  viewW: number;
  viewH: number;
  children?: React.ReactNode;
}> = ({ clip, from, rate = 1, keys, viewW, viewH, children }) => {
  const t = useSec();
  const { fps } = useVideoConfig();
  const c = camAt(keys, t);
  const hx = viewW / 2;
  const hy = viewH / 2;
  return (
    <AbsoluteFill style={{ overflow: "hidden", width: viewW, height: viewH }}>
      <div
        style={{
          position: "absolute",
          width: 1920,
          height: 1080,
          zoom: c.zoom,
          transform: `translate(${hx / c.zoom - c.cx}px, ${hy / c.zoom - c.cy}px)`,
          transformOrigin: `${c.cx}px ${c.cy}px`,
        }}
      >
        <OffthreadVideo
          src={staticFile(`footage/clips/${clip}.mp4`)}
          muted
          trimBefore={Math.round(from * fps)}
          playbackRate={rate}
          style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }}
        />
        {children}
      </div>
    </AbsoluteFill>
  );
};
