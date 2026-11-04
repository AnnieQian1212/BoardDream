/**
 * The two flows behind "testing your own idea takes weeks": a game made the old way, a loop that
 * costs a week a lap, and a game made with BoardDream, one sentence to a tested game. Drawn in
 * DashMotion's manner (dashed connectors that flow, a light that travels the path, pills at the ends,
 * every connector stopping 4px short of the box it points at), laid out left to right for a 16:9
 * frame. One geometry serves the film (Flows.tsx) and the stand-alone page that DashMotion's checker
 * reads (flows-html.mts).
 */

export const FRAME = { width: 1920, height: 1080 };

export type FlowNode = { id: string; lines: string[]; pill?: boolean; x: number; y: number; w: number; h: number };
export type FlowEdge = { from: string; to: string; d: string };
export type FlowLabel = { text: string; x: number; y: number; anchor: "start" | "middle" | "end" };
export type Flow = {
  id: "old" | "dream";
  eyebrow: string;
  eyebrowY: number;
  nodes: FlowNode[];
  /** Left to right along the row. */
  edges: FlowEdge[];
  /** The way back round: the old way's weekly lap, BoardDream's fix and test again. */
  loop: FlowEdge[];
  loopLabels: FlowLabel[];
  /** Over the last pill: how long it took. */
  after: FlowLabel;
};

export const TYPE = {
  label: 28,
  line: 36,
  pill: 22,
  eyebrow: 22,
  note: 30,
  after: 40,
};

const STEP_H = 2 * TYPE.line + 36;
const PILL_H = 68;
export const MARGIN = 90;
const LEFT = MARGIN;
const RIGHT = FRAME.width - MARGIN;
/** Gap between a box and the arrowhead pointing at it. */
const SHORT = 4;

/** Wide enough for the longest line, with room either side (Inter at TYPE.label; pills set in caps). */
const widthOf = (lines: string[], pill: boolean) => {
  const chars = Math.max(...lines.map((l) => l.length));
  return Math.round(pill ? chars * TYPE.pill * 0.75 + 60 : chars * TYPE.label * 0.48 + 60);
};

type Spec = { id: string; lines: string[]; pill?: boolean };

/** Boxes spread evenly across the frame, centred on one line. */
const row = (specs: Spec[], cy: number): FlowNode[] => {
  const sized = specs.map((s) => ({ ...s, w: widthOf(s.lines, !!s.pill), h: s.pill ? PILL_H : STEP_H }));
  const gap = (RIGHT - LEFT - sized.reduce((sum, n) => sum + n.w, 0)) / (sized.length - 1);
  let x = LEFT;
  return sized.map((n) => {
    const node = { ...n, x: Math.round(x), y: cy - n.h / 2 };
    x += n.w + gap;
    return node;
  });
};

const along = (nodes: FlowNode[], cy: number): FlowEdge[] =>
  nodes.slice(1).map((to, i) => {
    const from = nodes[i];
    return { from: from.id, to: to.id, d: `M${from.x + from.w} ${cy} H${to.x - SHORT}` };
  });

const at = (nodes: FlowNode[], id: string) => {
  const found = nodes.find((n) => n.id === id);
  if (!found) throw new Error(`no node ${id}`);
  return found;
};
const cx = (n: FlowNode) => n.x + n.w / 2;

const OLD_Y = 300;
const DREAM_Y = 650;

const oldNodes = row(
  [
    { id: "idea", lines: ["AN IDEA"], pill: true },
    { id: "rules", lines: ["Write the rules", "by hand"] },
    { id: "paper", lines: ["Cut a paper", "prototype"] },
    { id: "night", lines: ["Wait for a", "playtest night"] },
    { id: "play", lines: ["FINALLY, PLAY"], pill: true },
  ],
  OLD_Y,
);

const oldLoop = (() => {
  const night = at(oldNodes, "night");
  const rules = at(oldNodes, "rules");
  const bottom = OLD_Y + STEP_H / 2;
  const rail = bottom + 56;
  return {
    edges: [{ from: "night", to: "rules", d: `M${cx(night)} ${bottom} V${rail} H${cx(rules)} V${bottom + SHORT}` }],
    labels: [{ text: "Not fun yet? Rewrite it, and wait a week.", x: (cx(night) + cx(rules)) / 2, y: rail + 46, anchor: "middle" as const }],
  };
})();

const dreamNodes = row(
  [
    { id: "sentence", lines: ["ONE SENTENCE"], pill: true },
    { id: "spark", lines: ["Muse Spark", "designs it"] },
    { id: "mechanics", lines: ["Picks tested", "mechanics"] },
    { id: "code", lines: ["Writes the", "rules as code"] },
    { id: "bots", lines: ["Bots play", "1,000 games"] },
    { id: "play", lines: ["PLAY TONIGHT"], pill: true },
  ],
  DREAM_Y,
);

const fix = (() => {
  const bots = at(dreamNodes, "bots");
  const lines = ["Muse Spark", "fixes it"];
  const w = widthOf(lines, false);
  const top = DREAM_Y + STEP_H / 2 + 84;
  const node: FlowNode = { id: "fix", lines, x: Math.round(cx(bots) - w / 2), y: top, w, h: STEP_H };
  const bottom = DREAM_Y + STEP_H / 2;
  const down = cx(bots) - 46;
  const up = cx(bots) + 46;
  const mid = (bottom + top) / 2 + 10;
  return {
    node,
    edges: [
      { from: "bots", to: "fix", d: `M${down} ${bottom} V${top - SHORT}` },
      { from: "fix", to: "bots", d: `M${up} ${top} V${bottom + SHORT}` },
    ],
    labels: [
      { text: "if it breaks", x: down - 18, y: mid, anchor: "end" as const },
      { text: "test again", x: up + 18, y: mid, anchor: "start" as const },
    ],
  };
})();

const afterPill = (nodes: FlowNode[], text: string): FlowLabel => {
  const play = at(nodes, "play");
  return { text, x: cx(play), y: play.y - 30, anchor: "middle" };
};

export const FLOWS: { old: Flow; dream: Flow } = {
  old: {
    id: "old",
    eyebrow: "The old way",
    eyebrowY: OLD_Y - STEP_H / 2 - 52,
    nodes: oldNodes,
    edges: along(oldNodes, OLD_Y),
    loop: oldLoop.edges,
    loopLabels: oldLoop.labels,
    after: afterPill(oldNodes, "weeks later"),
  },
  dream: {
    id: "dream",
    eyebrow: "With BoardDream",
    eyebrowY: DREAM_Y - STEP_H / 2 - 52,
    nodes: [...dreamNodes, fix.node],
    edges: along(dreamNodes, DREAM_Y),
    loop: fix.edges,
    loopLabels: fix.labels,
    after: afterPill(dreamNodes, "minutes later"),
  },
};

/** The flows' palette: the old way in faded cream, BoardDream in gold. */
export const INK = {
  ground: "#120d0a",
  grid: "#211912",
  old: { stroke: "#8a7d69", fill: "rgba(191,177,155,0.05)", text: "#bfb19b", dot: "#d9ccb6" },
  dream: { stroke: "#d9a441", fill: "rgba(217,164,65,0.08)", text: "#f5ecdc", dot: "#f0cf86" },
};
