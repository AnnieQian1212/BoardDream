// The Xiaohongshu (RED) note cover, 3:4 at 1080 x 1440: the promise, large enough to read in the
// feed's two-column grid, over the game made in the film on its painted table.
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import "./lib/theme";
import { C, F, displaySoft, lift } from "./lib/theme";
import { Mark, Stage } from "./lib/ui";

/** The recorded table's crop, in the page's CSS px (the frame is 1920 x 1080 CSS). */
// From y 132, below the recording's pointer and top bar.
const CROP = { x: 70, y: 132, w: 1800, h: 940 };
const WIN = { x: 40, y: 862, w: 1040, h: (1040 * CROP.h) / CROP.w };

export const RedCover: React.FC = () => (
  <Stage>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 40% at 55% 76%, rgba(242,207,124,0.6) 0%, rgba(242,207,124,0) 70%)" }} />

    {/* The brand. */}
    <div style={{ position: "absolute", left: 72, top: 70, display: "flex", alignItems: "center", gap: 18 }}>
      <Mark size={72} id="red" />
      <span style={{ fontFamily: F.display, ...displaySoft, fontWeight: 650, fontSize: 60, color: C.ink }}>BoardDream</span>
    </div>
    <div
      style={{
        position: "absolute",
        right: 60,
        top: 86,
        padding: "10px 22px",
        borderRadius: 999,
        background: C.ink,
        color: C.panel,
        fontFamily: F.ui,
        fontWeight: 700,
        fontSize: 28,
        transform: "rotate(3deg)",
        whiteSpace: "nowrap",
      }}
    >
      Meta AI Hackathon
    </div>

    {/* The promise. */}
    <div
      style={{
        position: "absolute",
        left: 62,
        top: 196,
        fontFamily: F.display,
        ...displaySoft,
        fontWeight: 700,
        fontSize: 150,
        lineHeight: 1.0,
        letterSpacing: "-0.025em",
        color: C.ink,
        isolation: "isolate",
      }}
    >
      <div>One sentence.</div>
      <div style={{ position: "relative", display: "inline-block", marginTop: 6 }}>
        <span style={{ position: "absolute", left: -10, right: -14, bottom: 14, height: 54, background: C.goldLight, borderRadius: 10, transform: "skewX(-8deg)", zIndex: -1 }} />
        <span style={{ fontStyle: "italic" }}>Tonight&apos;s</span>
      </div>
      <div>board game.</div>
    </div>
    <div style={{ position: "absolute", left: 70, top: 690, width: 940, fontFamily: F.ui, fontWeight: 600, fontSize: 40, lineHeight: 1.3, color: C.muted }}>
      I built an AI that designs, tests and paints a board game from one sentence.
    </div>

    {/* The game made in the film, on its painted table. */}
    <div style={{ position: "absolute", inset: 0, perspective: 1800, perspectiveOrigin: "50% 70%" }}>
      <div
        style={{
          position: "absolute",
          left: WIN.x,
          top: WIN.y,
          width: WIN.w,
          height: WIN.h,
          borderRadius: 22,
          overflow: "hidden",
          transform: "rotateX(14deg) rotateZ(-2deg)",
          transformOrigin: "50% 100%",
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

    {/* The real run, stuck on the table's corner. */}
    <div
      style={{
        position: "absolute",
        left: 590,
        top: 820,
        padding: "12px 26px",
        borderRadius: 16,
        background: C.mochi,
        color: "#fff8ec",
        fontFamily: F.ui,
        fontWeight: 800,
        fontSize: 36,
        transform: "rotate(-4deg)",
        boxShadow: "0 10px 24px rgba(30,20,10,0.3)",
        whiteSpace: "nowrap",
      }}
    >
      Real run · made in 8:37
    </div>

  </Stage>
);
