// Shot 1, bars 1–4 (7.38 s): BoardDream pressed in ink (shotcraft brand-ink-open, from
// demos/typography/brand-ink-open/BrandInkOpen.tsx, its 30 fps timings in seconds), then the line the
// hackathon rules ask for: what existed before the event and what was built during it.
// A gold crosshair is drawn where the mark lands, the mark and each letter are pressed in (scale
// 1.6 → 1, blur → 0, a gold glint under each), the promise is typed in the display italic; the
// wordmark holds still for a second, then the lockup steps up to a header (shotcraft
// title-demote-to-label grammar) on beat 6 and a two-row ledger comes in under a gold rule: at
// kickoff, a two-line README (the repo's first commit, shown as it is); Oct 26 – Nov 4, everything
// in the film. The ledger holds still over 3 s, then everything lifts and dissolves into the next shot.
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { C, F, displaySoft } from "../lib/theme";
import { BEAT, EASE, prog, useSec } from "../lib/time";
import { Caption, Mark, Stage } from "../lib/ui";

const WORD = "BoardDream";
const LINE = "Describe a board game in one sentence. Play it tonight.";

// Card timings at 30 fps → seconds: crosshair v 0–9f, h 8–18f, fade 24–34f; glyph i at 10+3i for 12f.
const CROSS_V: [number, number] = [0, 0.3];
const CROSS_H: [number, number] = [0.27, 0.6];
const CROSS_FADE: [number, number] = [0.8, 1.13];
const MARK_AT = 0.3; // the mark presses first, landing near beat 2
const GLYPH_AT = (i: number) => 0.46 + i * 0.085; // first letter on beat 1
const GLYPH_DUR = 0.4;
const LINE_AT = 2.5 * BEAT; // typing starts half a beat before beat 3, done by 2.15 s
const PER_CHAR = 0.018;
const DEMOTE: [number, number] = [2.4, 6 * BEAT]; // the lockup becomes a header, landing on beat 6
const ROW1 = 6 * BEAT; // 2.769 s
const ROW2 = 7 * BEAT; // 3.231 s, one row at a time
const OUT_AT = 7.2; // the ledger fully in by ~4.05 s, held still ~3.15 s, then 0.18 s out
const OUT_END = 7.38;

// The repository's first commit (58cff20, Oct 26 2026, 5:39 PM ET): README.md, two lines.
const README = ["# BoardDream", "Project for Meta Global AI Developer Hackathon"];
const RULE_X = 600;

/** A two-line small caps label, right-aligned against the ledger's rule. */
const Label: React.FC<{ t: number; at: number; y: number; top: string; bottom: string; color: string }> = ({ t, at, y, top, bottom, color }) => {
  const k = prog(t, at, at + 0.4);
  return (
    <div style={{ position: "absolute", right: 1920 - (RULE_X - 40), top: y, textAlign: "right", fontFamily: F.ui, fontWeight: 700, fontSize: 30, letterSpacing: "0.16em", lineHeight: 1.3, opacity: k, transform: `translateX(${(1 - k) * -24}px)` }}>
      <div style={{ color: C.muted }}>{top}</div>
      <div style={{ color }}>{bottom}</div>
    </div>
  );
};

export const Open: React.FC = () => {
  const t = useSec();
  const v = prog(t, CROSS_V[0], CROSS_V[1]);
  const h = prog(t, CROSS_H[0], CROSS_H[1], (x) => x);
  const crossFade = 1 - prog(t, CROSS_FADE[0], CROSS_FADE[1], (x) => x);

  const out = prog(t, OUT_AT, OUT_END, (x) => x * x);
  const chars = Math.max(0, Math.floor((t - LINE_AT) / PER_CHAR));
  const typedDone = LINE_AT + LINE.length * PER_CHAR;
  const cursorOn = t >= LINE_AT && (t < typedDone || (Math.floor((t - typedDone) / 0.13) % 2 === 0 && t < DEMOTE[0]));
  const demote = prog(t, DEMOTE[0], DEMOTE[1], EASE.cam);
  const rule = prog(t, ROW1, ROW1 + 0.35, EASE.out);
  const card = prog(t, ROW1 + 0.12, ROW1 + 0.45, EASE.land);
  const readmeChars = Math.max(0, Math.floor((t - (ROW1 + 0.2)) / 0.011));

  const markK = prog(t, MARK_AT, MARK_AT + 0.42, (x) => 1 - Math.pow(1 - x, 3));
  const markGlint = interpolate(t, [MARK_AT + 0.3, MARK_AT + 0.42, MARK_AT + 0.6], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Stage>
      <AbsoluteFill style={{ opacity: 1 - out, transform: `translateY(${-40 * out}px)` }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", transform: `translateY(${-300 * demote}px) scale(${1 - 0.4 * demote})`, marginTop: -40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 34, position: "relative" }}>
            {/* the mark, with the crosshair drawn by an invisible gold pen where it lands */}
            <div style={{ position: "relative", width: 168, height: 168 }}>
              <svg width={220} height={220} viewBox="0 0 64 64" style={{ position: "absolute", left: -26, top: -26, opacity: crossFade }}>
                <line x1={32} y1={2} x2={32} y2={62} stroke={C.gold} strokeWidth={2.4} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - v)} />
                <line x1={2} y1={32} x2={62} y2={32} stroke={C.gold} strokeWidth={2.4} strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - h)} />
                <circle cx={32} cy={32} r={20} fill="none" stroke={C.gold} strokeWidth={1.4} pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - h)} opacity={0.7} />
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: markK,
                  transform: `scale(${1.6 - 0.6 * markK})`,
                  transformOrigin: "center bottom",
                  filter: markK < 0.995 ? `blur(${(1 - markK) * 6}px)` : undefined,
                }}
              >
                <Mark size={168} id="open-mark" style={{ filter: "drop-shadow(0 6px 10px rgba(70,48,25,0.22))" }} />
              </div>
              <div style={{ position: "absolute", left: "50%", bottom: -14, transform: "translateX(-50%)", width: `${markGlint * 100}%`, height: 3, background: C.gold, opacity: markGlint, borderRadius: 2 }} />
            </div>
            {/* the wordmark, letter by letter */}
            <div
              style={{
                fontFamily: F.display,
                ...displaySoft,
                fontSize: 172,
                fontWeight: 600,
                color: C.ink,
                letterSpacing: "-0.015em",
                lineHeight: 1,
                display: "inline-flex",
                alignItems: "flex-end",
                textShadow: "0 1px 0 rgba(255,253,248,0.75)",
              }}
            >
              {WORD.split("").map((ch, i) => {
                const a = GLYPH_AT(i);
                const k = prog(t, a, a + GLYPH_DUR, (x) => {
                  // the card's bezier(0.2, 0.7, 0.25, 1), approximated as a strong ease-out
                  return 1 - Math.pow(1 - x, 3.2);
                });
                const g = interpolate(t, [a + GLYPH_DUR - 0.13, a + GLYPH_DUR, a + GLYPH_DUR + 0.13], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                return (
                  <span key={i} style={{ position: "relative", display: "inline-block", opacity: k, transform: `scale(${1.6 - 0.6 * k})`, transformOrigin: "center bottom", filter: k < 0.995 ? `blur(${(1 - k) * 6}px)` : undefined }}>
                    {ch}
                    <span style={{ position: "absolute", left: "50%", bottom: -8, transform: "translateX(-50%)", width: `${g * 100}%`, height: 3, background: C.gold, opacity: g, borderRadius: 2 }} />
                  </span>
                );
              })}
            </div>
          </div>
          {/* the promise, typed */}
          <div
            style={{
              marginTop: 54,
              height: 64,
              fontFamily: F.display,
              ...displaySoft,
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: 54,
              color: C.inkSoft,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              whiteSpace: "pre",
            }}
          >
            {/* the full line laid out invisibly keeps the typed text from drifting as it grows */}
            <span style={{ position: "relative" }}>
              <span style={{ visibility: "hidden" }}>{LINE}</span>
              <span style={{ position: "absolute", left: 0, top: 0 }}>
                {LINE.slice(0, chars)}
                <span style={{ display: "inline-block", width: 16, height: 48, marginLeft: 6, verticalAlign: "-6px", background: C.gold, opacity: cursorOn ? 0.9 : 0 }} />
              </span>
            </span>
          </div>
        </div>
      </AbsoluteFill>

      {/* the ledger: before the event, and during it */}
      <div style={{ position: "absolute", left: RULE_X - 1.5, top: 400, width: 3, height: 470, background: C.gold, borderRadius: 2, transformOrigin: "top", transform: `scaleY(${rule})` }} />
      <Label t={t} at={ROW1} y={408} top="AT KICKOFF" bottom="OCT 26" color={C.goldDeep} />
      <Caption text="A two-line README. Nothing else." at={ROW1 + 0.02} x={RULE_X + 44} y={396} size={60} align="left" width={1220} stagger={0.035} />
      <div
        style={{
          position: "absolute",
          left: RULE_X + 44,
          top: 486,
          borderRadius: 12,
          background: C.code,
          border: `1.5px solid ${C.ink}`,
          boxShadow: `0 3px 0 ${C.ink}, 0 14px 28px rgba(70,48,25,0.16)`,
          overflow: "hidden",
          opacity: card > 0 ? 1 : 0,
          transform: `translateY(${(1 - card) * 26}px) rotate(${(1 - card) * -1.5}deg)`,
          transformOrigin: "left center",
        }}
      >
        <div style={{ padding: "6px 18px", background: "rgba(45,32,22,0.07)", borderBottom: `1px solid ${C.line}`, fontFamily: F.mono, fontSize: 24, color: C.faint }}>README.md · first commit, 58cff20</div>
        <div style={{ padding: "12px 22px 14px", fontFamily: F.mono, fontSize: 32, lineHeight: 1.4, color: C.ink, whiteSpace: "pre" }}>
          {/* laid out in full, revealed character by character, so the card keeps its size */}
          {README.map((line, i) => {
            const before = README.slice(0, i).reduce((n, l) => n + l.length, 0);
            const shown = Math.max(0, Math.min(line.length, readmeChars - before));
            return (
              <div key={i} style={{ position: "relative", fontWeight: i === 0 ? 600 : 400 }}>
                <span style={{ visibility: "hidden" }}>{line}</span>
                <span style={{ position: "absolute", left: 0, top: 0 }}>{line.slice(0, shown)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <Label t={t} at={ROW2} y={704} top="THE HACKATHON" bottom="OCT 26 – NOV 4" color={C.accentStrong} />
      <Caption text="Everything you'll see was built at the Meta AI Developer Hackathon." at={ROW2 + 0.02} x={RULE_X + 44} y={692} size={60} align="left" width={1220} stagger={0.03} mark={["built"]} />
      </AbsoluteFill>
    </Stage>
  );
};
