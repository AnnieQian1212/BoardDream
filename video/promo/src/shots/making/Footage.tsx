// The app's screen recordings (public/footage/clips: 2560 × 1440, 60 fps, the page laid out at
// 1920 × 1080 CSS) placed like the stills were: a 2.5D page camera over the recording, and a crop of
// the same recording lifted out as a card. Coordinates are the page's CSS px.
import React from "react";
import { AbsoluteFill, Freeze, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { camAt, type CamKey } from "../../lib/PageCam";
import { useSec } from "../../lib/time";

export type Clip = {
  /** File name in public/footage/clips, without .mp4. */
  name: string;
  /** Seconds into the clip at the start of the enclosing Sequence. */
  from: number;
  /** Clip seconds per film second. */
  rate: number;
  /** Film seconds (within the Sequence) after which the picture holds still. */
  freezeAt?: number;
};

/** The clip's own time at a film time t (seconds within the Sequence). */
export const clipTime = (c: Clip, t: number) => c.from + c.rate * (c.freezeAt === undefined ? t : Math.min(t, c.freezeAt));

const Video: React.FC<{ clip: Clip; style: React.CSSProperties }> = ({ clip, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const freezeFrame = clip.freezeAt === undefined ? undefined : Math.round(clip.freezeAt * fps);
  const video = (
    <OffthreadVideo
      src={staticFile(`footage/clips/${clip.name}.mp4`)}
      muted
      trimBefore={Math.round(clip.from * fps)}
      playbackRate={clip.rate}
      style={style}
    />
  );
  if (freezeFrame === undefined) return video;
  return (
    <Freeze frame={freezeFrame} active={frame >= freezeFrame}>
      {video}
    </Freeze>
  );
};

/** A page camera over a recording, framed in a viewport of viewW × viewH. */
export const FootageCam: React.FC<{
  clip: Clip;
  keys: CamKey[];
  viewW: number;
  viewH: number;
  children?: React.ReactNode;
  /** Override the camera (e.g. a crash zoom computed by the shot). */
  cam?: { cx: number; cy: number; zoom: number };
}> = ({ clip, keys, viewW, viewH, children, cam: camProp }) => {
  const t = useSec();
  const c = camProp ?? camAt(keys, t);
  const hx = viewW / 2;
  const hy = viewH / 2;
  return (
    <AbsoluteFill style={{ overflow: "hidden", width: viewW, height: viewH, background: "#eadcc0" }}>
      <div
        style={{
          position: "absolute",
          width: 1920,
          height: 1080,
          zoom: c.zoom,
          transform: `translate(${hx / c.zoom - c.cx}px, ${hy / c.zoom - c.cy}px)`,
        }}
      >
        <Video clip={clip} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }} />
        {children}
      </div>
    </AbsoluteFill>
  );
};

/** A page rect of the recording shown at `zoom` (layout px per CSS px), clipped to the rect. */
export const FootageCrop: React.FC<{ clip: Clip; rect: { x: number; y: number; w: number; h: number }; zoom: number }> = ({ clip, rect, zoom }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: rect.w * zoom, height: rect.h * zoom, overflow: "hidden" }}>
    {/* As in PageCam: under CSS zoom a translate is scaled by the zoom too. */}
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zoom, transform: `translate(${-rect.x}px, ${-rect.y}px)` }}>
      <Video clip={clip} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }} />
    </div>
  </div>
);
