/**
 * Writes the two flows (src/flowLayout.ts) as one stand-alone DashMotion page: dashed connectors that
 * flow, a light travelling each path, the pause toggle and reduced-motion handling of DashMotion's
 * template, and the film's fonts embedded so it looks the same anywhere. DashMotion's checker
 * (check_diagram.py) reads this page; the film draws the same geometry in Flows.tsx.
 *
 *   npx tsx video/remotion/flows-html.mts <out.html>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FLOWS, FRAME, INK, MARGIN, TYPE, type Flow } from "./src/flowLayout";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
if (!out) throw new Error("usage: flows-html.mts <out.html>");

const font = (pkg: string, file: string) =>
  `url(data:font/woff2;base64,${readFileSync(join(here, "node_modules/@fontsource-variable", pkg, "files", file)).toString("base64")}) format("woff2")`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** The points of an orthogonal path, for the light that rides it. */
const points = (d: string) => {
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
const motion = (d: string) =>
  points(d)
    .map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`)
    .join(" ");

const draw = (flow: Flow) => {
  const ink = INK[flow.id];
  const slow = flow.id === "old";
  const connectors = [...flow.edges, ...flow.loop]
    .map((e) => `      <path class="flow${slow ? " slow" : ""}" d="${e.d}" marker-end="url(#arrow)"/>`)
    .join("\n");
  // One light per hop, each leaving as the last arrives (DashMotion's chained begin).
  const hops = [...flow.edges.slice(0, -1), ...flow.loop, flow.edges[flow.edges.length - 1]];
  const hop = slow ? 1.1 : 0.45;
  const dots = hops
    .map((e, i) => {
      const id = `${flow.id}_dot_${i}`; // SMIL reads a "-" in an id as an offset: underscores only.
      const begin = i === 0 ? `0s;${flow.id}_dot_${hops.length - 1}.end+0.6s` : `${flow.id}_dot_${i - 1}.end`;
      // Shown only while it travels, so it never waits in a corner between laps.
      return `      <circle r="7" class="dot" opacity="0"><animateMotion id="${id}" dur="${hop}s" begin="${begin}" fill="freeze" path="${motion(e.d)}"/><set attributeName="opacity" to="1" begin="${id}.begin" end="${id}.end"/></circle>`;
    })
    .join("\n");
  const boxes = flow.nodes
    .map((n) => {
      const rx = n.pill ? n.h / 2 : 14;
      const mid = n.y + n.h / 2;
      const text = n.pill
        ? `<text x="${n.x + n.w / 2}" y="${mid + TYPE.pill * 0.36}" class="pill-label">${esc(n.lines[0])}</text>`
        : n.lines
            .map((l, i) => `<text x="${n.x + n.w / 2}" y="${mid + (i - (n.lines.length - 1) / 2) * TYPE.line + TYPE.label * 0.36}" class="label">${esc(l)}</text>`)
            .join("");
      return `      <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${rx}" fill="${INK.ground}"/><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${rx}" fill="${ink.fill}" stroke="${ink.stroke}" stroke-width="${n.pill ? 2.5 : 2}"/>${text}`;
    })
    .join("\n");
  const notes = [...flow.loopLabels.map((l) => ({ ...l, cls: "note" })), { ...flow.after, cls: "after" }]
    .map((l) => `      <text x="${l.x}" y="${l.y}" text-anchor="${l.anchor}" class="${l.cls}">${esc(l.text)}</text>`)
    .join("\n");
  return `    <g class="${flow.id}" style="--stroke:${ink.stroke};--text:${ink.text}">
      <text x="${MARGIN}" y="${flow.eyebrowY}" class="eyebrow">${esc(flow.eyebrow.toUpperCase())}</text>
    <g stroke="${ink.stroke}" stroke-width="2" fill="none">
${connectors}
    </g>
    <g fill="${ink.dot}">
${dots}
    </g>
${boxes}
${notes}
    </g>`;
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BoardDream — two ways to make a game</title>
<style>
  @font-face { font-family: "Inter Variable"; font-weight: 100 900; src: ${font("inter", "inter-latin-wght-normal.woff2")}; }
  @font-face { font-family: "Fraunces Variable"; font-style: italic; font-weight: 100 900; src: ${font("fraunces", "fraunces-latin-wght-italic.woff2")}; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: ${INK.ground}; min-height: 100vh; display: grid; place-items: center; padding: 2vmin; }
  .diagram-card {
    width: min(96vw, calc(96vh * 16 / 9)); aspect-ratio: 16 / 9; position: relative; border-radius: 12px; overflow: hidden;
    background:
      repeating-linear-gradient(0deg, ${INK.grid} 0 1px, transparent 1px 40px),
      repeating-linear-gradient(90deg, ${INK.grid} 0 1px, transparent 1px 40px),
      ${INK.ground};
    background-size: calc(100% * 40 / ${FRAME.width}) calc(100% * 40 / ${FRAME.height});
  }
  svg { display: block; width: 100%; height: 100%; }
  .pause-btn {
    position: absolute; top: 12px; right: 12px; background: transparent; border: 1px solid #3a2e24; color: #bfb19b;
    border-radius: 6px; padding: 4px 10px; font: 12px "Inter Variable", system-ui, sans-serif; cursor: pointer;
  }
  .eyebrow { font: 600 ${TYPE.eyebrow}px "Inter Variable", system-ui, sans-serif; letter-spacing: 0.22em; fill: var(--stroke); }
  .label { font: 500 ${TYPE.label}px "Inter Variable", system-ui, sans-serif; fill: var(--text); text-anchor: middle; }
  .pill-label { font: 650 ${TYPE.pill}px "Inter Variable", system-ui, sans-serif; letter-spacing: 0.14em; fill: var(--text); text-anchor: middle; }
  .note { font: italic 400 ${TYPE.note}px "Fraunces Variable", Georgia, serif; fill: var(--text); }
  .after { font: italic 500 ${TYPE.after}px "Fraunces Variable", Georgia, serif; fill: var(--text); }
  .dream .pill-label, .dream .note, .dream .after { fill: #f0cf86; }
  .flow { stroke-dasharray: 10 10; }
  @media (prefers-reduced-motion: no-preference) {
    .flow { animation: dashmove 0.75s linear infinite; }
    .flow.slow { animation-duration: 2.4s; }
  }
  @keyframes dashmove { to { stroke-dashoffset: -20; } }
  body.paused .flow { animation-play-state: paused; }
</style>
</head>
<body>
<div class="diagram-card">
  <button class="pause-btn" id="pauseBtn" aria-pressed="false">⏸ pause</button>
  <svg id="flowsvg" viewBox="0 0 ${FRAME.width} ${FRAME.height}" role="img" aria-labelledby="t d">
    <title id="t">Two ways to make a board game</title>
    <desc id="d">The old way loops through writing rules, a paper prototype and a playtest night, a week a lap, for weeks. BoardDream goes from one sentence through Muse Spark, tested mechanics, rules as code and a thousand bot games, fixing anything that breaks, to a game you play tonight.</desc>
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </marker>
    </defs>
${draw(FLOWS.old)}
${draw(FLOWS.dream)}
  </svg>
</div>
<script>
  (function () {
    var svg = document.getElementById('flowsvg');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.dot').forEach(function (d) { d.remove(); });
      document.getElementById('pauseBtn').remove();
      return;
    }
    var btn = document.getElementById('pauseBtn');
    var paused = false;
    btn.addEventListener('click', function () {
      paused = !paused;
      document.body.classList.toggle('paused', paused);
      paused ? svg.pauseAnimations() : svg.unpauseAnimations();
      btn.textContent = paused ? '▶ play' : '⏸ pause';
      btn.setAttribute('aria-pressed', String(paused));
    });
  })();
</script>
</body>
</html>
`;
writeFileSync(out, html);
console.log(`wrote ${out}`);
