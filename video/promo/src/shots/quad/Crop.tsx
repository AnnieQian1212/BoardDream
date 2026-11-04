// A region of a full-page still (1920 x 1080 CSS px, drawn at 2x), shown at `scale`: real pixels
// lifted out of the app, not redrawn.
import React from "react";
import { Img } from "remotion";

export type Region = { x: number; y: number; w: number; h: number };

export const Crop: React.FC<{
  src: string;
  region: Region;
  scale: number;
  style?: React.CSSProperties;
  radius?: number;
  pageW?: number;
  pageH?: number;
  children?: React.ReactNode;
}> = ({ src, region, scale, style, radius = 0, pageW = 1920, pageH = 1080, children }) => (
  <div style={{ position: "absolute", width: region.w * scale, height: region.h * scale, overflow: "hidden", borderRadius: radius, ...style }}>
    <Img
      src={src}
      style={{ position: "absolute", left: -region.x * scale, top: -region.y * scale, width: pageW * scale, height: pageH * scale, maxWidth: "none" }}
    />
    {children}
  </div>
);

/** A page point inside a crop, in the crop's own (scaled) pixels. */
export const inCrop = (region: Region, scale: number, px: number, py: number) => ({ x: (px - region.x) * scale, y: (py - region.y) * scale });
