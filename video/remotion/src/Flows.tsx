import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ease } from "./fx";
import { FLOWS, FRAME, INK, MARGIN, TYPE, type Flow, type FlowEdge, type FlowNode } from "./flowLayout";
import { DISPLAY, UI } from "./theme";

/**
 * "Testing your own idea takes weeks": the old way drawn first, going round its loop a week a lap,
 * then BoardDream racing from one sentence to a game you play tonight. The geometry and look are the
 * DashMotion page's (flowLayout.ts, flows-html.mts); here everything moves on the film's clock, so the
 * dashes flow and the lights travel the same way in every render.
 */

/** When each thing happens, in seconds from the start of the scene. */
const CUE = {
  old: { start: 0.15, step: 0.2, loopFrom: 1.4, lap: 0.85, laps: 3 },
  dream: { start: 3.9, step: 0.09, run: 4.55, hop: 0.2, count: [5.2, 6.4] as [number, number] },
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const progress = (t: number, from: number, seconds: number) => clamp01((t - from) / seconds);

/** The corners of an orthogonal path ("M x y H x V y ..."). */
const corners = (d: string): [number, number][] => {
  const pts: [number, number][] = [];
  let x = 0;
  let y = 0;
  for (const [, op, a, b] of d.matchAll(/([MHV])\s*(-?[\d.]+)(?:\s+(-?[\d.]+))?/g)) {
    if (op === "M") [x, y] = [Number(a), Number(b)];
    if (op === "H") x = Number(a);
    if (op === "V") y = Number(a);
    pts.push([x, y]);
  }
  return pts;
};

/** The point a fraction `f` of the way along a path. */
const pointAt = (d: string, f: number): [number, number] => {
  const pts = corners(d);
  const legs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let left = clamp01(f) * legs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < legs.length; i++) {
    if (left <= legs[i] || i === legs.length - 1) {
      const k = legs[i] ? left / legs[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
    }
    left -= legs[i];
  }
  return pts[0];
};

/** A connector that draws itself in from its source, then flows. */
const Connector: React.FC<{ edge: FlowEdge; id: string; t: number; from: number; stroke: string; period: number }> = ({ edge, id, t, from, stroke, period }) => {
  const shown = ease(progress(t, from, 0.32));
  if (shown <= 0) return null;
  return (
    <g>
      <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={FRAME.width} height={FRAME.height}>
        <path d={edge.d} pathLength={1} fill="none" stroke="white" strokeWidth={24} strokeDasharray="1 1" strokeDashoffset={1 - shown} />
      </mask>
      <path
        d={edge.d}
        fill="none"
        stroke={stroke}
        strokeWidth={2.5}
        strokeDasharray="10 10"
        // One dash period (20) per `period` seconds, in the direction of the path.
        strokeDashoffset={(-t / period) * 20}
        markerEnd="url(#flow-arrow)"
        mask={`url(#${id})`}
      />
    </g>
  );
};

/** A box or a pill, rising into place. */
const Box: React.FC<{ node: FlowNode; t: number; at: number; ink: (typeof INK)["old"]; lit?: number; label?: string[] }> = ({ node, t, at, ink, lit = 0, label }) => {
  const p = ease(progress(t, at, 0.45));
  if (p <= 0) return null;
  const rx = node.pill ? node.h / 2 : 14;
  const mid = node.y + node.h / 2;
  const lines = label ?? node.lines;
  return (
    <g opacity={p} transform={`translate(0 ${(1 - p) * 14})`}>
      <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={rx} fill={INK.ground} />
      <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={rx} fill={ink.fill} stroke={ink.stroke} strokeWidth={node.pill ? 3 : 2.5} />
      {lit > 0 && (
        <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={rx} fill={ink.stroke} opacity={0.22 * lit} stroke={ink.dot} strokeWidth={3} filter="url(#flow-glow)" />
      )}
      {node.pill ? (
        <text x={node.x + node.w / 2} y={mid + TYPE.pill * 0.36} textAnchor="middle" fill={lit > 0 ? ink.dot : ink.text} style={{ font: `650 ${TYPE.pill}px ${UI}`, letterSpacing: "0.14em" }}>
          {lines[0]}
        </text>
      ) : (
        lines.map((l, i) => (
          <text
            key={i}
            x={node.x + node.w / 2}
            y={mid + (i - (lines.length - 1) / 2) * TYPE.line + TYPE.label * 0.36}
            textAnchor="middle"
            fill={ink.text}
            style={{ font: `500 ${TYPE.label}px ${UI}`, fontVariantNumeric: "tabular-nums" }}
          >
            {l}
          </text>
        ))
      )}
    </g>
  );
};

const Note: React.FC<{ x: number; y: number; anchor: "start" | "middle" | "end"; text: string; t: number; at: number; color: string; size?: number; weight?: number }> = ({
  x,
  y,
  anchor,
  text,
  t,
  at,
  color,
  size = TYPE.note,
  weight = 400,
}) => {
  const p = ease(progress(t, at, 0.5));
  if (p <= 0) return null;
  return (
    <text x={x} y={y + (1 - p) * 12} textAnchor={anchor} fill={color} opacity={p} style={{ font: `italic ${weight} ${size}px ${DISPLAY}` }}>
      {text}
    </text>
  );
};

/** A light riding a path, with a soft halo. */
const Light: React.FC<{ d: string; f: number; color: string }> = ({ d, f, color }) => {
  const [x, y] = pointAt(d, f);
  return (
    <g>
      <circle cx={x} cy={y} r={18} fill={color} opacity={0.22} filter="url(#flow-glow)" />
      <circle cx={x} cy={y} r={7.5} fill={color} />
    </g>
  );
};

const Eyebrow: React.FC<{ flow: Flow; t: number; at: number }> = ({ flow, t, at }) => {
  const p = ease(progress(t, at, 0.5));
  return (
    <text x={MARGIN} y={flow.eyebrowY} opacity={p} fill={INK[flow.id].stroke} style={{ font: `600 ${TYPE.eyebrow}px ${UI}`, letterSpacing: "0.22em" }}>
      {flow.eyebrow.toUpperCase()}
    </text>
  );
};

const byId = (flow: Flow, id: string) => flow.nodes.find((n) => n.id === id)!;

const OldWay: React.FC<{ t: number }> = ({ t }) => {
  const flow = FLOWS.old;
  const ink = INK.old;
  const { start, step, loopFrom, lap, laps } = CUE.old;
  const row = flow.nodes;
  const appear = (i: number) => start + 0.1 + i * step;
  // The light: one lap is rules → paper → night → back round to rules; then out to the last pill.
  const lapPath = [flow.edges[1], flow.edges[2], flow.loop[0]];
  const lapEnd = loopFrom + laps * lap;
  let light: React.ReactNode = null;
  if (t >= loopFrom && t < lapEnd) {
    const within = ((t - loopFrom) % lap) / lap;
    const leg = Math.min(2, Math.floor(within * 3));
    light = <Light d={lapPath[leg].d} f={within * 3 - leg} color={ink.dot} />;
  } else if (t >= lapEnd && t < lapEnd + 0.35) {
    light = <Light d={flow.edges[3].d} f={(t - lapEnd) / 0.35} color={ink.dot} />;
  }
  const week = Math.min(laps, Math.floor((t - loopFrom) / lap) + 1);
  const rules = byId(flow, "rules");
  const label = flow.loopLabels[0];
  return (
    <g>
      <Eyebrow flow={flow} t={t} at={start} />
      {flow.edges.map((e, i) => (
        <Connector key={i} edge={e} id={`old-edge-${i}`} t={t} from={appear(i) + 0.2} stroke={ink.stroke} period={2.4} />
      ))}
      <Connector edge={flow.loop[0]} id="old-loop" t={t} from={appear(3) + 0.25} stroke={ink.stroke} period={2.4} />
      {light}
      {row.map((n, i) => (
        <Box key={n.id} node={n} t={t} at={appear(i)} ink={ink} lit={n.id === "play" ? progress(t, lapEnd + 0.3, 0.4) : 0} />
      ))}
      <Note {...label} t={t} at={appear(3) + 0.4} color={ink.text} />
      {t >= loopFrom && (
        <Note x={rules.x + rules.w / 2 - 26} y={label.y} anchor="end" text={`week ${week}`} t={t} at={loopFrom} color="#f5ecdc" weight={600} />
      )}
      <Note {...flow.after} t={t} at={lapEnd + 0.3} color={ink.text} size={TYPE.after} weight={500} />
    </g>
  );
};

const Dream: React.FC<{ t: number }> = ({ t }) => {
  const flow = FLOWS.dream;
  const ink = INK.dream;
  const { start, step, run, hop, count } = CUE.dream;
  const row = flow.nodes.filter((n) => n.id !== "fix");
  const fix = byId(flow, "fix");
  const appear = (i: number) => start + 0.1 + i * step;
  // The light runs the row to the bots, goes round the fix once, then on to the last pill.
  const legs: FlowEdge[] = [...flow.edges.slice(0, 4), flow.loop[0], flow.loop[1], flow.edges[4]];
  const end = run + legs.length * hop;
  const leg = Math.floor((t - run) / hop);
  const light = t >= run && t < end ? <Light d={legs[leg].d} f={(t - run - leg * hop) / hop} color={ink.dot} /> : null;
  const games = Math.round(1000 * ease(progress(t, count[0], count[1] - count[0])));
  return (
    <g>
      <Eyebrow flow={flow} t={t} at={start} />
      {flow.edges.map((e, i) => (
        <Connector key={i} edge={e} id={`dream-edge-${i}`} t={t} from={appear(i) + 0.12} stroke={ink.stroke} period={0.75} />
      ))}
      {flow.loop.map((e, i) => (
        <Connector key={i} edge={e} id={`dream-loop-${i}`} t={t} from={appear(5) + 0.1 + i * 0.1} stroke={ink.stroke} period={0.75} />
      ))}
      {light}
      {row.map((n, i) => (
        <Box
          key={n.id}
          node={n}
          t={t}
          at={appear(i)}
          ink={ink}
          lit={n.id === "play" ? progress(t, end - 0.05, 0.35) : 0}
          label={n.id === "bots" ? ["Bots play", `${games.toLocaleString("en-US")} games`] : undefined}
        />
      ))}
      <Box node={fix} t={t} at={appear(5) + 0.05} ink={ink} />
      {flow.loopLabels.map((l, i) => (
        <Note key={i} {...l} t={t} at={appear(5) + 0.2} color={ink.dot} />
      ))}
      <Note {...flow.after} t={t} at={end} color={ink.dot} size={TYPE.after} weight={500} />
    </g>
  );
};

export const TwoWays: React.FC<{ lead: number; speed?: number }> = ({ lead, speed = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // A shorter cut plays the diagram's own clock faster.
  const t = (frame / fps - lead) * speed;
  // The old way steps back once BoardDream takes the floor.
  const dim = 1 - 0.45 * ease(progress(t, CUE.dream.start, 0.6));
  const grid = `repeating-linear-gradient(0deg, ${INK.grid} 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, ${INK.grid} 0 1px, transparent 1px 40px)`;
  return (
    <AbsoluteFill style={{ background: INK.ground }}>
      <AbsoluteFill style={{ backgroundImage: grid, opacity: ease(progress(t, -0.3, 0.6)) }} />
      <svg viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </marker>
          <filter id="flow-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        <g opacity={dim}>
          <OldWay t={t} />
        </g>
        <Dream t={t} />
      </svg>
    </AbsoluteFill>
  );
};
