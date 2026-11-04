// The video's cover (YouTube thumbnail): the game made in the film, Clovefire Reach, on its painted
// 3D table, beside a five-word promise. Rendered as a still at 1280 x 720 and 2560 x 1440.
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import "./lib/theme";
import { C, F, displaySoft, lift } from "./lib/theme";
import { Mark, ModelChip, Stage } from "./lib/ui";

/** The part of the recorded table the cover shows, in the page's CSS px (the frame is 1920 x 1080 CSS). */
const CROP = { x: 70, y: 78, w: 1800, h: 950 };
const WIN = { x: 820, y: 190, w: 1150, h: (1150 * CROP.h) / CROP.w };

export const Thumbnail: React.FC = () => (
  <Stage>
    {/* Warm light behind the table. */}
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 55% 60% at 74% 52%, rgba(242,207,124,0.55) 0%, rgba(242,207,124,0) 70%)" }} />

    {/* The painted table, tilted like a board on a desk. */}
    <div style={{ position: "absolute", inset: 0, perspective: 2000, perspectiveOrigin: "70% 50%" }}>
      <div
        style={{
          position: "absolute",
          left: WIN.x,
          top: WIN.y,
          width: WIN.w,
          height: WIN.h,
          borderRadius: 22,
          overflow: "hidden",
          transform: "rotateY(-16deg) rotateX(7deg) rotateZ(1.2deg)",
          transformOrigin: "30% 50%",
          background: C.panel,
          ...lift(6),
          boxShadow: `0 6px 0 ${C.ink}, 0 40px 80px rgba(70, 48, 25, 0.35)`,
        }}
      >
        <Img
          src={staticFile("shots/thumb/table-1.png")}
          style={{
            position: "absolute",
            width: (1920 / CROP.w) * WIN.w,
            height: (1080 / CROP.w) * WIN.w,
            left: (-CROP.x / CROP.w) * WIN.w,
            top: (-CROP.y / CROP.w) * WIN.w,
          }}
        />
      </div>
    </div>

    {/* The brand. */}
    <div style={{ position: "absolute", left: 92, top: 84, display: "flex", alignItems: "center", gap: 22 }}>
      <Mark size={92} id="thumb" />
      <span style={{ fontFamily: F.display, ...displaySoft, fontWeight: 650, fontSize: 76, color: C.ink, letterSpacing: "-0.01em" }}>BoardDream</span>
    </div>

    {/* The promise: five words, readable at a phone's thumbnail size. */}
    <div
      style={{
        position: "absolute",
        left: 86,
        top: 268,
        width: 900,
        fontFamily: F.display,
        ...displaySoft,
        fontWeight: 700,
        fontSize: 150,
        lineHeight: 0.98,
        letterSpacing: "-0.025em",
        color: C.ink,
        textShadow: "0 2px 0 rgba(251,243,225,0.9), 0 0 24px rgba(251,243,225,0.9)",
        isolation: "isolate",
      }}
    >
      <div>One</div>
      <div>sentence.</div>
      <div style={{ position: "relative", display: "inline-block", marginTop: 14 }}>
        <span
          style={{
            position: "absolute",
            left: -10,
            right: -14,
            bottom: 14,
            height: 54,
            background: C.goldLight,
            borderRadius: 10,
            transform: "skewX(-8deg)",
            zIndex: -1,
          }}
        />
        <span style={{ position: "relative", fontStyle: "italic" }}>Tonight&apos;s</span>
      </div>
      <div>game.</div>
    </div>

    {/* What makes it: the Meta models, small. */}
    <div style={{ position: "absolute", left: 92, top: 958, display: "flex", gap: 14 }}>
      <ModelChip name="Muse Spark" size={30} />
      <ModelChip name="Muse Image" size={30} tone="gold" />
      <ModelChip name="SAM 3.1" size={30} tone="ink" />
    </div>

    {/* The real run, on the table's corner. */}
    <div
      style={{
        position: "absolute",
        left: 1210,
        top: 104,
        whiteSpace: "nowrap",
        padding: "12px 26px",
        borderRadius: 999,
        background: C.ink,
        color: C.panel,
        fontFamily: F.ui,
        fontWeight: 700,
        fontSize: 34,
        transform: "rotate(2deg)",
        boxShadow: "0 8px 22px rgba(30,20,10,0.3)",
      }}
    >
      Made from 1 sentence in 8:37
    </div>
  </Stage>
);
