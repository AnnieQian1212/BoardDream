// origin: video-shotcraft assets/lib/PageCam.tsx (the template film's page camera), keyed in seconds
// so it runs the same at any frame rate. A 2.5D camera over a full-page still: (cx, cy) is the page
// point centred in the 1920 x 1080 frame, zoom 1 = 1 CSS px per output px. Magnification goes
// through CSS `zoom` (layout scale), so the 2x stills rasterize sharp under zoom and perspective.
import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { EASE, lerp, prog, useSec } from "./time";

export type CamKey = {
  t: number; // seconds within the enclosing Sequence
  cx: number;
  cy: number;
  zoom: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  persp?: number;
};

export const camAt = (keys: CamKey[], t: number, ease = EASE.cam) => {
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i].t && t <= keys[i + 1].t) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  if (t < keys[0].t) b = a;
  const k = a.t === b.t ? 1 : prog(t, a.t, b.t, ease);
  return {
    cx: lerp(a.cx, b.cx, k),
    cy: lerp(a.cy, b.cy, k),
    zoom: lerp(a.zoom, b.zoom, k),
    rotX: lerp(a.rotX ?? 0, b.rotX ?? 0, k),
    rotY: lerp(a.rotY ?? 0, b.rotY ?? 0, k),
    rotZ: lerp(a.rotZ ?? 0, b.rotZ ?? 0, k),
    persp: lerp(a.persp ?? 1400, b.persp ?? 1400, k),
  };
};

export const PageCam: React.FC<{
  src: string;
  keys: CamKey[];
  pageW?: number;
  pageH?: number;
  /** Width/height of the viewport the camera frames (default the full frame). */
  viewW?: number;
  viewH?: number;
  children?: React.ReactNode;
  background?: string;
  ease?: (x: number) => number;
  /** Override the clock (seconds), e.g. to freeze or remap time. */
  t?: number;
}> = ({ src, keys, pageW = 1920, pageH = 1080, viewW = 1920, viewH = 1080, children, background = "transparent", ease, t: tProp }) => {
  const own = useSec();
  const c = camAt(keys, tProp ?? own, ease);
  const hx = viewW / 2;
  const hy = viewH / 2;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background, width: viewW, height: viewH }}>
      <div style={{ position: "absolute", inset: 0, perspective: `${c.persp * c.zoom}px`, perspectiveOrigin: `${hx}px ${hy}px` }}>
        <div
          style={{
            position: "absolute",
            width: pageW,
            height: pageH,
            zoom: c.zoom,
            transform: `translate(${hx / c.zoom - c.cx}px, ${hy / c.zoom - c.cy}px) rotateY(${c.rotY}deg) rotateX(${c.rotX}deg) rotateZ(${c.rotZ}deg)`,
            transformOrigin: `${c.cx}px ${c.cy}px`,
            transformStyle: "preserve-3d",
          }}
        >
          <Img src={src} style={{ position: "absolute", left: 0, top: 0, width: pageW, height: pageH }} />
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};
