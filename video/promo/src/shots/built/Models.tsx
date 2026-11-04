// Part (c): four Meta models, four jobs. The title is up from the cut; four cards in the app's lifted-panel look land one per beat
// with an overshoot (BoardDream's motion voice, y1 > 1), then the open-source line. One motion idea:
// the drop and settle; no glints.
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { C, F, displaySoft, lift } from "../../lib/theme";
import { BEAT, EASE, prog } from "../../lib/time";
import { Caption, Stage } from "../../lib/ui";

const MODELS = [
  { name: "Muse Spark", job: "Designs each game and writes its rules as code", tone: C.accent, glyph: "✦" },
  { name: "Muse Spark Open", job: "Plays the empty seats, and talks at the table", tone: C.accentStrong, glyph: "♟" },
  { name: "Muse Image", job: "Paints every box cover, card and board", tone: C.gold, glyph: "✎" },
  { name: "SAM 3.1", job: "Checks that every painted tile sits on the board", tone: C.ink, glyph: "⬡" },
];
const CW = 410;
const CH = 360;
const GAP = 28;
const LEFT = (1920 - (CW * 4 + GAP * 3)) / 2;
const TOP = 384;

export const Models: React.FC<{ t: number }> = ({ t }) => {
  const foot = prog(t, 4 * BEAT + 0.1, 4 * BEAT + 0.45); // the row is complete at 1.85 s; row and footer then hold still to the end (3.7 s)
  return (
    <AbsoluteFill>
      <Stage>
        <Caption text="Four Meta models, four jobs" at={-1} x={960} y={196} size={72} mark={["four", "jobs"]} stagger={0.045} />
        {MODELS.map((m, i) => {
          const land = (i + 1) * BEAT; // each card lands on a beat
          const k = prog(t, land - 0.32, land, EASE.land);
          const shown = interpolate(t, [land - 0.32, land - 0.24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={m.name}
              style={{
                position: "absolute",
                left: LEFT + i * (CW + GAP),
                top: TOP,
                width: CW,
                height: CH,
                boxSizing: "border-box",
                borderRadius: 20,
                background: C.card,
                ...lift(4),
                padding: "30px 32px",
                opacity: shown,
                transform: `translateY(${(1 - k) * 150}px) rotate(${(1 - k) * (i % 2 ? 4 : -4)}deg) scale(${0.9 + 0.1 * k})`,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 54, height: 54, borderRadius: 14, background: m.tone, color: C.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontFamily: F.ui, fontWeight: 700, border: `1.5px solid ${C.ink}` }}>{m.glyph}</div>
                <div style={{ fontFamily: F.ui, fontWeight: 700, fontSize: 24, letterSpacing: "0.14em", color: C.faint }}>MODEL {i + 1}</div>
              </div>
              <div style={{ marginTop: 26, fontFamily: F.display, ...displaySoft, fontWeight: 650, fontSize: m.name.length > 12 ? 42 : 48, lineHeight: 1.04, whiteSpace: "nowrap", letterSpacing: "-0.01em", color: C.ink }}>{m.name}</div>
              <div style={{ marginTop: 16, fontFamily: F.ui, fontWeight: 500, fontSize: 32, lineHeight: 1.25, color: C.muted }}>{m.job}</div>
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: TOP + CH + 66,
            textAlign: "center",
            fontFamily: F.ui,
            fontWeight: 600,
            fontSize: 36,
            color: C.muted,
            opacity: foot,
            transform: `translateY(${(1 - foot) * 14}px)`,
          }}
        >
          + open source: React · three.js · Rapier · Remotion
        </div>
      </Stage>
    </AbsoluteFill>
  );
};
