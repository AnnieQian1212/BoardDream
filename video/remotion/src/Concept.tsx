import React from "react";
import { AbsoluteFill, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandMark, Footage, Night, Rise, T, Wordmark, clamp, ease } from "./fx";
import { COVERS } from "./Reel";
import { Timeline, sceneSeconds, type Scene } from "./timeline";
import { C, DISPLAY, HEIGHT, UI, WIDTH } from "./theme";
import mergeTake from "../public/footage/merge.json";
import playTake from "../public/footage/play.json";
import host from "../public/footage/friends-host.json";
import guest from "../public/footage/friends-friend.json";

/**
 * Part 1 as a concept film, about thirty seconds: what BoardDream gives a table, not how. Real
 * results only (the games' covers, painted boards and card art, the mochi game, two friends at one
 * table), set in depth and light rather than shown as pages. The making, testing, house rules,
 * painting and invite are Part 2's.
 */

const IDEA = "Rival families settle a ring of volcanic islands, trade with neighbours and light lighthouses.";

const sec = (t: number, from: number, len: number) => ease(Math.min(1, Math.max(0, (t - from) / len)));
const useT = (lead = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps - lead;
};

/** A gold streak of light drifting across the dark. */
const Streak: React.FC<{ t: number; y: number; delay?: number; tilt?: number }> = ({ t, y, delay = 0, tilt = -12 }) => {
  const x = interpolate(t - delay, [0, 2.6], [-40, 140], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: `${x - 30}%`,
        top: y,
        width: "60%",
        height: 2,
        rotate: `${tilt}deg`,
        background: `linear-gradient(90deg, transparent, ${C.goldSoft}, transparent)`,
        boxShadow: `0 0 40px 8px ${C.gold}55`,
        opacity: 0.8,
      }}
    />
  );
};

/** The question, each word flying in out of depth and focus. */
const Question: React.FC<{ lead: number }> = ({ lead }) => {
  const t = useT(lead);
  const words = "What do you want to play tonight?".split(" ");
  return (
    <Night>
      <Streak t={t} y={300} />
      <Streak t={t} y={760} delay={0.5} tilt={8} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 1200 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 28px", width: 1500 }}>
          {words.map((w, i) => {
            const p = sec(t, 0.15 + i * 0.12, 0.9);
            return (
              <span
                key={i}
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 132,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  color: i === words.length - 1 ? C.goldSoft : C.cream,
                  fontStyle: i === words.length - 1 ? "italic" : "normal",
                  display: "inline-block",
                  opacity: p,
                  filter: `blur(${(1 - p) * 14}px)`,
                  transform: `translateZ(${(1 - p) * 500}px) translateY(${(1 - p) * 30}px)`,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </Night>
  );
};

/** One sentence written in light, which breaks into the games it could be. */
const Sentence: React.FC<{ lead: number }> = ({ lead }) => {
  const t = useT(lead);
  const shown = Math.floor(IDEA.length * sec(t, 0.1, 1.4));
  const burst = sec(t, 1.9, 1.1);
  const words = IDEA.split(" ");
  let count = 0;
  return (
    <Night glow={C.teal}>
      <AbsoluteFill style={{ perspective: 1400, alignItems: "center", justifyContent: "center" }}>
        {COVERS.slice(0, 9).map((c, i) => {
          const a = (i / 9) * Math.PI * 2;
          const p = sec(t, 1.95 + i * 0.05, 1.1);
          const r = 420 + 260 * random(`r${i}`);
          return (
            <Img
              key={c}
              src={staticFile(`covers/${c}`)}
              style={{
                position: "absolute",
                width: 300,
                height: 200,
                objectFit: "cover",
                borderRadius: 12,
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                opacity: p,
                transform: `translate(${Math.cos(a) * r * p}px, ${Math.sin(a) * r * 0.55 * p}px) translateZ(${-600 + 600 * p}px) rotateY(${Math.cos(a) * 25}deg) rotateZ(${(random(`z${i}`) - 0.5) * 16}deg)`,
              }}
            />
          );
        })}
        <div style={{ width: 1500, textAlign: "center", fontFamily: DISPLAY, fontStyle: "italic", fontSize: 64, lineHeight: 1.3, color: C.cream, textShadow: `0 0 30px ${C.gold}66` }}>
          {words.map((w, i) => {
            const start = count;
            count += w.length + 1;
            const visible = w.slice(0, Math.max(0, shown - start));
            const dx = (random(`x${i}`) - 0.5) * 900;
            const dy = (random(`y${i}`) - 0.5) * 600;
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginRight: "0.28em",
                  opacity: 1 - burst,
                  filter: `blur(${burst * 10}px)`,
                  transform: `translate(${dx * burst}px, ${dy * burst}px) scale(${1 + burst * 0.6}) rotate(${(random(`a${i}`) - 0.5) * 50 * burst}deg)`,
                }}
              >
                {visible}
              </span>
            );
          })}
          {burst === 0 && <span style={{ display: "inline-block", width: 3, height: 60, background: C.goldSoft, verticalAlign: "middle", opacity: Math.floor(t * 3) % 2 }} />}
        </div>
      </AbsoluteFill>
    </Night>
  );
};

/** A cover's game name from its file: "tidehearth-mw0zl535.webp" is Tidehearth. */
const gameName = (file: string) =>
  file
    .replace(/\.webp$/, "")
    .replace(/-mw[0-9a-z]+$/, "")
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

/** Fine paper grain, laid over a face to make it card. */
const Grain = () => (
  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", mixBlendMode: "multiply", opacity: 0.22 }}>
    <filter id="card-grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
      <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.3  0 0 0 0.9 0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#card-grain)" />
  </svg>
);

/** The colours of the boxes' sides, one after another round the ring. */
const SIDES = ["#2f5a46", "#8a3b2c", "#23485f", "#7a5a1e", "#4b3a6b", "#2e5f63"];

/**
 * A cover as a board game's box: the art on the lid with the name printed across a band, the
 * maker's mark in the corner, coloured sides with the name along them, card grain and a laminate
 * sheen. Built of real faces, so its sides show as the ring turns it.
 */
const GameBox: React.FC<{ cover: string; size: number; depth: number; side: string; shown: number }> = ({ cover, size, depth, side, shown }) => {
  const face = (transform: string, w: number, h: number, children: React.ReactNode, style: React.CSSProperties = {}) => (
    <div style={{ position: "absolute", left: (size - w) / 2, top: (size - h) / 2, width: w, height: h, transform, backfaceVisibility: "hidden", opacity: shown, overflow: "hidden", ...style }}>{children}</div>
  );
  const name = gameName(cover);
  const sideFace = (turn: number) =>
    face(
      `rotateY(${turn}deg) translateZ(${size / 2}px)`,
      depth,
      size,
      <>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${side}, color-mix(in srgb, ${side} 80%, black))` }} />
        <Grain />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, height: 2, background: "rgba(0,0,0,0.35)" }} />
        <div style={{ position: "absolute", left: "50%", top: "46%", translate: "-50% -50%", rotate: "90deg", whiteSpace: "nowrap", fontFamily: DISPLAY, fontSize: 24, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.goldSoft }}>{name}</div>
      </>,
    );
  return (
    <div style={{ position: "relative", width: size, height: size, transformStyle: "preserve-3d" }}>
      {/* The lid. */}
      {face(
        `translateZ(${depth / 2}px)`,
        size,
        size,
        <>
          <Img src={staticFile(`covers/${cover}`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "16px 18px 18px", background: `linear-gradient(180deg, transparent, ${C.night}e6 38%)` }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 38, fontWeight: 700, lineHeight: 1, letterSpacing: "0.02em", textTransform: "uppercase", color: C.cream, textAlign: "center", textShadow: "0 2px 0 rgba(0,0,0,0.5)" }}>{name}</div>
          </div>
          <div style={{ position: "absolute", left: 14, top: 14, display: "flex", alignItems: "center", gap: 6, padding: "5px 10px 5px 6px", borderRadius: 999, background: "rgba(18,13,10,0.7)" }}>
            <BrandMark size={20} />
            <span style={{ fontFamily: DISPLAY, fontSize: 14, fontWeight: 600, color: C.cream }}>BoardDream</span>
          </div>
          <Grain />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.08) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.25), inset 0 0 0 4px rgba(255,255,255,0.12)" }} />
        </>,
        { borderRadius: 4, boxShadow: "0 40px 70px rgba(0,0,0,0.55)" },
      )}
      {sideFace(90)}
      {sideFace(-90)}
      {/* Top and bottom. */}
      {face(`rotateX(90deg) translateZ(${size / 2}px)`, size, depth, <div style={{ position: "absolute", inset: 0, background: `color-mix(in srgb, ${side} 85%, white)` }} />)}
      {face(`rotateX(-90deg) translateZ(${size / 2}px)`, size, depth, <div style={{ position: "absolute", inset: 0, background: `color-mix(in srgb, ${side} 60%, black)` }} />)}
    </div>
  );
};

/**
 * The games' boxes on a turning ring, seen level, a little room between them; each fades as it
 * turns away to the side, so the ring reads as a smooth round.
 */
const Carousel: React.FC<{ lead: number }> = ({ lead }) => {
  const t = useT(lead);
  const n = 12;
  const size = 400;
  const depth = 84;
  const gap = 46;
  const radius = Math.round((n * (size + gap)) / (2 * Math.PI));
  const turn = -10 - t * 11;
  return (
    <Night>
      <AbsoluteFill style={{ perspective: 1700, perspectiveOrigin: "50% 40%" }}>
        <div style={{ position: "absolute", left: "50%", top: "40%", transformStyle: "preserve-3d", transform: `translateZ(-${radius}px) rotateY(${turn}deg)` }}>
          {Array.from({ length: n }, (_, i) => {
            const angle = (i * 360) / n;
            // How squarely it faces the camera: 1 in front, 0 side on.
            const facing = Math.cos(((angle + turn) * Math.PI) / 180);
            const shown = Math.min(1, Math.max(0, (facing - 0.15) / 0.45));
            const cover = COVERS[i % COVERS.length];
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: -size / 2,
                  top: -size / 2,
                  width: size,
                  transformStyle: "preserve-3d",
                  transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
                }}
              >
                <GameBox cover={cover} size={size} depth={depth} side={SIDES[i % SIDES.length]} shown={shown} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 66%, rgba(18,13,10,0.9) 86%)" }} />
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 230 }}>
        <Rise text="Every game, a world of its own." size={80} delay={0.3} />
      </AbsoluteFill>
    </Night>
  );
};

/** Painted boards lying in depth, the nearest rising toward the camera under a passing light. */
const Boards: React.FC<{ lead: number }> = ({ lead }) => {
  const t = useT(lead);
  const p = sec(t, 0, 2.6);
  const board = (src: string, x: number, y: number, z: number, w: number, tilt: number, spin: number, delay: number) => {
    const q = sec(t, delay, 2.4);
    return (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: w,
          transformStyle: "preserve-3d",
          transform: `translate(-50%, -50%) translate3d(${x}px, ${y + (1 - q) * 160}px, ${z}px) rotateX(${tilt - q * 8}deg) rotateZ(${spin + t * 2}deg)`,
          opacity: q,
        }}
      >
        <Img src={staticFile(`concept/${src}`)} style={{ width: "100%", borderRadius: 10, boxShadow: "0 60px 90px rgba(0,0,0,0.6)" }} />
      </div>
    );
  };
  const sweep = interpolate(t, [0.6, 2.6], [-40, 140], clamp);
  return (
    <Night glow={C.teal}>
      <AbsoluteFill style={{ perspective: 1600, perspectiveOrigin: "50% 30%" }}>
        {board("board-tidehearth.webp", -620, 40, -700, 900, 58, -14, 0.1)}
        {board("board-cloudwaft-harbor.webp", 640, 60, -650, 900, 58, 12, 0.25)}
        {board("board-basalt-kin-revised.webp", 0, 80, -80 + p * 120, 760, 54, -4, 0)}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(105deg, transparent ${sweep - 12}%, ${C.goldSoft}33 ${sweep}%, transparent ${sweep + 12}%)`, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 92 }}>
        <Rise text="Boards painted for every game" size={66} delay={0.4} />
      </AbsoluteFill>
    </Night>
  );
};

/** Card art from the games, each with the game it comes from. */
const CARDS: [string, string][] = [
  ["card-ash-canticle.webp", "Basalt Kin"],
  ["card-amber-bay-contract.webp", "Saffron Wake"],
  ["card-cliff-goat.webp", "Sunlit Pantheon"],
  ["card-brine-lark.webp", "Basalt Kin"],
  ["card-gull-cry.webp", "Tidehearth"],
  ["card-ash-runner.webp", "Sunlit Pantheon"],
  ["card-button-dart-courier.webp", "Cloudwaft Harbor"],
];
const title = (file: string) =>
  file
    .replace(/^card-|\.webp$/g, "")
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

/** A hand of the games' cards fanning out of the deck and turning face up. */
const Cards: React.FC<{ lead: number }> = ({ lead }) => {
  const t = useT(lead);
  return (
    <Night>
      <AbsoluteFill style={{ perspective: 1500, alignItems: "center", justifyContent: "center" }}>
        {CARDS.map(([c, game], i) => {
          const mid = (CARDS.length - 1) / 2;
          const p = sec(t, 0.1 + i * 0.07, 0.8);
          const flip = sec(t, 0.45 + i * 0.07, 0.6);
          const angle = (i - mid) * 9 * p;
          return (
            <div
              key={c}
              style={{
                position: "absolute",
                width: 290,
                height: 410,
                top: "50%",
                left: "50%",
                marginLeft: -145,
                marginTop: -262,
                transformOrigin: "50% 160%",
                transformStyle: "preserve-3d",
                transform: `rotate(${angle}deg) translateY(${-(1 - Math.abs(i - mid) / mid) * 30 * p}px) rotateY(${180 - flip * 180}deg)`,
              }}
            >
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", borderRadius: 18, background: C.paper, boxShadow: "0 30px 60px rgba(0,0,0,0.5)", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                <Img src={staticFile(`concept/${c}`)} style={{ width: "100%", height: 175, objectFit: "cover", borderRadius: 10 }} />
                <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 600, color: C.ink, textAlign: "center" }}>{title(c)}</div>
                <div style={{ height: 2, background: `${C.gold}88`, margin: "0 30px" }} />
                <div style={{ fontFamily: UI, fontSize: 15, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8a6a3a", textAlign: "center" }}>{game}</div>
              </div>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  borderRadius: 18,
                  background: `linear-gradient(140deg, #2f5a46, #1f3b2f)`,
                  boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `3px solid ${C.gold}`,
                }}
              >
                <BrandMark size={110} />
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 170 }}>
        <Rise text="Cards that set each other off" size={60} delay={0.5} italic color={C.goldSoft} weight={400} />
      </AbsoluteFill>
    </Night>
  );
};

/**
 * The mochi game, under a big title: the steamer's band set over the steamer and the blanket at the
 * centre, the guests' orders and the friends met on two smaller boards below. One take played
 * through without a cut (video/record/takes.mjs, merge): the steamer clicked once, then one mochi put
 * on another, which become a sakura mochi, a friend met. Every board is cut from the same moment.
 */
const MOCHI_FROM = mergeTake.marks.find((m) => m.label === "steam")!.t - 0.05;
type Crop = { x: number; y: number; w: number; h: number };
/** The steamer's band, from its title to the end of its hint, set as wide as the blanket below. */
// Measured on the take with the interface at 75% (apps/web/src/styles.css).
const BAND: Crop = { x: 6, y: 907, w: 716, h: 28 };
const BLANKET: Crop = { x: 494, y: 942, w: 526, h: 124 };
const ORDERS: Crop = { x: 1030, y: 946, w: 200, h: 118 };
const MET: Crop = { x: 1244, y: 953, w: 172, h: 106 };

/** A part of the page, cut out and set on a board of its own. */
const Cut: React.FC<{ crop: Crop; scale: number; lead: number }> = ({ crop, scale, lead }) => (
  <div style={{ width: crop.w * scale, height: crop.h * scale, overflow: "hidden", position: "relative" }}>
    <div style={{ width: WIDTH, height: HEIGHT, transformOrigin: "0 0", transform: `scale(${scale}) translate(${-crop.x}px, ${-crop.y}px)` }}>
      <Footage src="footage/merge.mp4" from={MOCHI_FROM} lead={lead} />
    </div>
  </div>
);

const Mochi: React.FC<{ lead: number }> = ({ lead }) => {
  const t = useT(lead);
  // The page's parts are drawn at 75%, so they are lifted a third more to keep their size on screen.
  const big = 1.7 / 0.75;
  const small = 1.45 / 0.75;
  const shadow = "0 40px 90px rgba(90,50,20,0.3), 0 0 0 1.5px rgba(90,50,20,0.16)";
  const rise = (delay: number) => {
    const p = sec(t, -0.3 + delay, 0.9);
    return { opacity: p, transform: `translateY(${(1 - p) * 50}px)` };
  };
  const label = (text: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: 34, fontFamily: UI, fontSize: 18, fontWeight: 700, letterSpacing: "0.26em", textTransform: "uppercase", color: C.rust }}>
      <span style={{ width: 22, height: 2, background: C.rust }} />
      {text}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, #fff6e6 0%, #f3dfc0 45%, #e3c49a 100%)` }}>
      {Array.from({ length: 14 }, (_, i) => {
        const x = random(`bx${i}`) * WIDTH;
        const y = (random(`by${i}`) * HEIGHT - t * (20 + 30 * random(`bs${i}`))) % HEIGHT;
        const r = 30 + 90 * random(`br${i}`);
        return <div key={i} style={{ position: "absolute", left: x, top: (y + HEIGHT) % HEIGHT, width: r, height: r, borderRadius: "50%", background: "#ffffff", opacity: 0.25, filter: "blur(6px)" }} />;
      })}
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <Rise text="While your game is made" size={96} color={C.ink} delay={0.05} />
      </AbsoluteFill>
      <AbsoluteFill style={{ perspective: 2000 }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 250,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 40,
            transform: `translateX(-50%) rotateX(${5 - t * 0.4}deg) translateY(${Math.sin(t * 1.4) * 4}px)`,
          }}
        >
          <div style={{ ...rise(0) }}>
            <div style={{ borderRadius: "16px 16px 0 0", overflow: "hidden" }}>
              <Cut crop={BAND} scale={(BLANKET.w * big) / BAND.w} lead={lead} />
            </div>
            <div style={{ borderRadius: "0 0 16px 16px", overflow: "hidden", boxShadow: shadow, background: "#fbf3e4" }}>
              <Cut crop={BLANKET} scale={big} lead={lead} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
            <div style={{ ...rise(0.15) }}>
              {label("Orders")}
              <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: shadow, background: "#fbf3e4" }}>
                <Cut crop={ORDERS} scale={small} lead={lead} />
              </div>
            </div>
            <div style={{ ...rise(0.27) }}>
              {label("Friends met")}
              <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: shadow, background: "#fbf3e4" }}>
                <Cut crop={MET} scale={small} lead={lead} />
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A game being played: pieces landing on a board, the camera close over it. */
const Play: React.FC<{ lead: number }> = ({ lead }) => {
  const t = useT(lead);
  return (
    <AbsoluteFill>
      <Footage
        src="footage/play.mp4"
        from={playTake.marks[0].t + 0.3}
        lead={lead}
        camera={[
          { at: 0, zoom: 1.15, focus: [720, 420] },
          { at: 0.15, zoom: 1.45, focus: [760, 330], over: 1.1 },
        ]}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 70% at 50% 55%, transparent 55%, rgba(18,13,10,0.55) 100%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(18,13,10,0.7) 0%, transparent 26%)" }} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 56 }}>
        <div style={{ fontFamily: UI, fontSize: 24, fontWeight: 700, letterSpacing: "0.3em", color: C.goldSoft, textTransform: "uppercase", opacity: sec(t, 0.1, 0.6) }}>Tonight</div>
        <div style={{ marginTop: 10 }}>
          <Rise text="Your move." size={92} delay={0.25} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Two friends' screens drifting together until they are one table. */
const Friends: React.FC<{ lead: number }> = ({ lead }) => {
  const t = useT(lead);
  const p = sec(t, 0, 2.2);
  const box = { width: 860, height: 484 };
  const screen = (src: string, from: number, side: -1 | 1, name: string, color: string) => (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: box.width,
        height: box.height,
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: `0 40px 90px rgba(0,0,0,0.55), 0 0 0 2px ${color}`,
        transform: `translate(-50%, -50%) translateX(${side * (560 - 120 * p)}px) translateZ(${-200 + 100 * p}px) rotateY(${-side * (24 - 10 * p)}deg)`,
      }}
    >
      {/* The whole page, made small. */}
      <div style={{ width: WIDTH, height: HEIGHT, transformOrigin: "0 0", transform: `scale(${box.width / WIDTH})` }}>
        <Footage src={src} from={from} lead={0} />
      </div>
      <div style={{ position: "absolute", left: 18, top: 18, padding: "8px 16px", borderRadius: 999, background: "rgba(18,13,10,0.8)", color: C.cream, fontFamily: UI, fontSize: 22, fontWeight: 600 }}>{name}</div>
    </div>
  );
  const at = (take: { marks: { label: string; t: number }[] }) => take.marks.find((m) => m.label === "dealt")!.t + 1.5;
  return (
    <Night glow={C.rust}>
      <AbsoluteFill style={{ perspective: 1600 }}>
        {screen("footage/friends-host.mp4", at(host), -1, "Aichen", C.rust)}
        {screen("footage/friends-friend.mp4", at(guest), 1, "Mira", C.teal)}
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 110 }}>
        <Rise text="Game night, every night." size={80} delay={0.4} />
      </AbsoluteFill>
    </Night>
  );
};

const SCENES: Scene[] = [
  { name: "The question", seconds: 2.8, render: (lead) => <Question lead={lead} />, then: T.blur(0.5) },
  { name: "One sentence", seconds: 3.2, render: (lead) => <Sentence lead={lead} />, then: T.fade(0.4) },
  { name: "Every game", seconds: 3.8, render: (lead) => <Carousel lead={lead} />, then: T.blur(0.5) },
  { name: "Painted boards", seconds: 3.4, render: (lead) => <Boards lead={lead} />, then: T.push(0.5, "from-bottom") },
  { name: "Cards", seconds: 2.2, render: (lead) => <Cards lead={lead} />, then: T.leak(0.9, 4) },
  { name: "The mochi game", seconds: 5, render: (lead) => <Mochi lead={lead} />, then: T.blur(0.5) },
  { name: "Playing", seconds: 4.6, render: (lead) => <Play lead={lead} />, then: T.blur(0.5) },
  { name: "Friends", seconds: 3, render: (lead) => <Friends lead={lead} />, then: T.fade(0.5) },
  {
    name: "End",
    seconds: 2,
    render: () => (
      <Night>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
          <Wordmark size={96} />
          <Rise text="Dream it up. Play it tonight." size={58} delay={0.3} italic color={C.goldSoft} weight={400} />
        </AbsoluteFill>
      </Night>
    ),
  },
];

export const CONCEPT_SECONDS = sceneSeconds(SCENES);

export const Concept: React.FC = () => <Timeline scenes={SCENES} />;
