import type { CardView, Geometry, ResourceSpec } from "@boarddream/engine";
import type { LucideIcon } from "lucide-react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { iconFor, tagStyle } from "../icons";
import {
  alpha,
  canvas2d,
  CREAM,
  drawIcon,
  fitFont,
  FONT_DISPLAY,
  FONT_UI,
  grainPattern,
  hash,
  hexPath,
  INK,
  mix,
  noise2,
  roundRect,
  seeded,
  softRect,
  wrap,
} from "./paint";

/** Card face pixels; the 600 x 838 canvas matches the 63 x 88 mm card the scene uses. */
const CW = 600;
const CH = 838;

function texture(canvas: HTMLCanvasElement, color = true): CanvasTexture {
  const t = new CanvasTexture(canvas);
  if (color) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function cached<T>(cache: Map<string, T>, key: string, make: () => T): T {
  let value = cache.get(key);
  if (value === undefined) {
    value = make();
    cache.set(key, value);
  }
  return value;
}

// ---------- Cards ----------

const faces = new Map<string, CanvasTexture>();

/** Fires when a texture changes after creation (card art finished loading), so the scene can redraw. */
export const textureUpdates = new EventTarget();

export function cardFace(card: CardView, resources: Map<string, ResourceSpec>): CanvasTexture {
  const costs = Object.entries(card.cost ?? {}).filter(([, n]) => n > 0);
  const key = JSON.stringify([card.title, card.text, costs, card.points, card.tags, card.art, costs.map(([id]) => resources.get(id))]);
  return cached(faces, key, () => {
    const [canvas, ctx] = canvas2d(CW, CH);
    paintFace(ctx, card, costs, resources);
    const t = texture(canvas);
    if (card.art) {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        paintFace(ctx, card, costs, resources, image);
        t.needsUpdate = true;
        textureUpdates.dispatchEvent(new Event("update"));
      };
      image.src = card.art;
    }
    return t;
  });
}

function paintFace(ctx: CanvasRenderingContext2D, card: CardView, costs: [string, number][], resources: Map<string, ResourceSpec>, art?: HTMLImageElement) {
  const { color: tag, icon } = tagStyle(card.tags?.[0]);

  // Card stock.
  const paper = ctx.createLinearGradient(0, 0, CW, CH);
  paper.addColorStop(0, "#fbf6ea");
  paper.addColorStop(1, "#ecdfc3");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, CW, CH);
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, CW, CH);
  roundRect(ctx, 16, 16, CW - 32, CH - 32, 26);
  ctx.lineWidth = 5;
  ctx.strokeStyle = alpha(tag, 0.6);
  ctx.stroke();
  roundRect(ctx, 27, 27, CW - 54, CH - 54, 19);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = alpha(INK, 0.16);
  ctx.stroke();

  // Illustration window.
  const [ax, ay, aw, ah] = [42, 120, CW - 84, 352];
  ctx.save();
  roundRect(ctx, ax, ay, aw, ah, 18);
  ctx.clip();
  if (art) {
    // Painted art leaves a wide paper margin; zoom in so the subject fills the window.
    const s = Math.max(aw / art.width, ah / art.height) * 1.3;
    ctx.drawImage(art, ax + (aw - art.width * s) / 2, ay + (ah - art.height * s) / 2, art.width * s, art.height * s);
  } else {
    paintWash(ctx, tag, icon, ax, ay, aw, ah, hash(card.title));
  }
  const vignette = ctx.createRadialGradient(ax + aw / 2, ay + ah / 2, ah * 0.35, ax + aw / 2, ay + ah / 2, aw * 0.72);
  vignette.addColorStop(0, "rgba(40, 25, 10, 0)");
  vignette.addColorStop(1, "rgba(40, 25, 10, 0.3)");
  ctx.fillStyle = vignette;
  ctx.fillRect(ax, ay, aw, ah);
  ctx.restore();
  roundRect(ctx, ax, ay, aw, ah, 18);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = alpha(INK, 0.4);
  ctx.stroke();

  // Cost pills, top left.
  const pillW = Math.min(112, (CW - 200 - 10 * (costs.length - 1)) / Math.max(1, costs.length));
  costs.forEach(([id, n], i) => {
    const res = resources.get(id);
    const color = res?.color ?? "#7d8a84";
    const x = 42 + i * (pillW + 10);
    ctx.save();
    ctx.shadowColor = "rgba(30, 20, 5, 0.35)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    const fill = ctx.createLinearGradient(0, 40, 0, 102);
    fill.addColorStop(0, mix(color, "#ffffff", 0.2));
    fill.addColorStop(1, mix(color, "#000000", 0.18));
    roundRect(ctx, x, 40, pillW, 62, 31);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
    roundRect(ctx, x + 1.5, 41.5, pillW - 3, 59, 29.5);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.stroke();
    drawIcon(ctx, iconFor(res?.icon), x + 31, 71, 32, "#ffffff", 2.5);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 34px ${FONT_UI}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), x + pillW - 28, 73);
  });

  // Points medallion, top right.
  if (card.points) {
    const [cx, cy, r] = [CW - 80, 71, 42];
    ctx.save();
    ctx.shadowColor = "rgba(30, 20, 5, 0.4)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    const gold = ctx.createRadialGradient(cx - 12, cy - 14, 4, cx, cy, r);
    gold.addColorStop(0, "#fff0bf");
    gold.addColorStop(0.45, "#e9b950");
    gold.addColorStop(1, "#a8741f");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 6, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(90, 60, 10, 0.45)";
    ctx.stroke();
    ctx.fillStyle = "#3a2a0e";
    ctx.font = `700 42px ${FONT_DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(card.points), cx, cy + 2);
  }

  // Title and tags.
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  fitFont(ctx, card.title, CW - 100, 52, 28, (size) => `600 ${size}px ${FONT_DISPLAY}`);
  ctx.fillText(card.title, CW / 2, 534);
  if (card.tags?.length) {
    ctx.font = `700 20px ${FONT_UI}`;
    ctx.letterSpacing = "4px";
    const parts = card.tags.map((t) => t.toUpperCase());
    const sep = "   ·   ";
    const total = ctx.measureText(parts.join(sep)).width;
    let x = CW / 2 - total / 2;
    ctx.textAlign = "left";
    parts.forEach((part, i) => {
      ctx.fillStyle = tagStyle(card.tags![i]).color;
      ctx.fillText(part, x, 572);
      x += ctx.measureText(part).width;
      if (i < parts.length - 1) {
        ctx.fillStyle = alpha(INK, 0.35);
        ctx.fillText(sep, x, 572);
        x += ctx.measureText(sep).width;
      }
    });
    ctx.letterSpacing = "0px";
  }

  // Rules text box.
  if (card.text) {
    const [bx, by, bw, bh] = [46, 598, CW - 92, CH - 598 - 48];
    roundRect(ctx, bx, by, bw, bh, 16);
    ctx.fillStyle = alpha(tag, 0.09);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = alpha(tag, 0.25);
    ctx.stroke();
    let size = 31;
    let lines: string[] = [];
    for (; size >= 19; size--) {
      ctx.font = `500 ${size}px ${FONT_UI}`;
      lines = wrap(ctx, card.text, bw - 44);
      if (lines.length * size * 1.3 <= bh - 30) break;
    }
    ctx.fillStyle = "#43392c";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lh = size * 1.3;
    const top = by + bh / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => ctx.fillText(line, CW / 2, top + i * lh));
  }
}

/** Placeholder illustration until card art is painted: a watercolor wash behind an ink drawing. */
function paintWash(ctx: CanvasRenderingContext2D, tag: string, icon: LucideIcon, x: number, y: number, w: number, h: number, seed: number) {
  const rand = seeded(seed);
  const base = ctx.createLinearGradient(x, y, x, y + h);
  base.addColorStop(0, mix(tag, "#fbf6ea", 0.7));
  base.addColorStop(1, mix(tag, "#efe2c6", 0.42));
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 8; i++) {
    const bx = x + rand() * w;
    const by = y + rand() * h;
    const br = (0.2 + rand() * 0.4) * w;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, alpha(mix(tag, "#ffffff", 0.15), 0.25 + rand() * 0.3));
    g.addColorStop(1, alpha(tag, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  const ground = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h);
  ground.addColorStop(0, alpha(tag, 0));
  ground.addColorStop(1, alpha(mix(tag, INK, 0.25), 0.5));
  ctx.fillStyle = ground;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  const cx = x + w / 2;
  const cy = y + h * 0.5;
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.48);
  halo.addColorStop(0, "rgba(255, 252, 240, 0.6)");
  halo.addColorStop(1, "rgba(255, 252, 240, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(x, y, w, h);
  drawIcon(ctx, icon, cx + 3, cy + 4, h * 0.6, alpha(mix(tag, INK, 0.3), 0.25), 1.6);
  drawIcon(ctx, icon, cx, cy, h * 0.6, mix(tag, INK, 0.55), 1.3);
}

let back: CanvasTexture | undefined;

export function cardBack(): CanvasTexture {
  if (back) return back;
  const [canvas, ctx] = canvas2d(CW, CH);
  const bg = ctx.createLinearGradient(0, 0, CW, CH);
  bg.addColorStop(0, "#2d3550");
  bg.addColorStop(1, "#161b2b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);
  ctx.strokeStyle = "rgba(233, 190, 98, 0.12)";
  ctx.lineWidth = 2;
  for (let row = -1; row < 16; row++) {
    for (let col = -1; col < 12; col++) {
      hexPath(ctx, col * 56 + (row % 2) * 28, row * 49, 26);
      ctx.stroke();
    }
  }
  const glow = ctx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, CW * 0.6);
  glow.addColorStop(0, "rgba(30, 36, 56, 0.95)");
  glow.addColorStop(0.5, "rgba(30, 36, 56, 0.6)");
  glow.addColorStop(1, "rgba(30, 36, 56, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CW, CH);
  roundRect(ctx, 26, 26, CW - 52, CH - 52, 20);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(233, 190, 98, 0.75)";
  ctx.stroke();
  roundRect(ctx, 38, 38, CW - 76, CH - 76, 14);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(233, 190, 98, 0.35)";
  ctx.stroke();
  const gold = ctx.createLinearGradient(CW / 2 - 110, CH / 2 - 130, CW / 2 + 110, CH / 2 + 110);
  gold.addColorStop(0, "#f6d98b");
  gold.addColorStop(1, "#c98a24");
  hexPath(ctx, CW / 2, CH / 2 - 20, 118);
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.beginPath();
  const [sx, sy, s] = [CW / 2, CH / 2 - 20, 62];
  ctx.moveTo(sx, sy - s);
  ctx.quadraticCurveTo(sx + 8, sy - 8, sx + s, sy);
  ctx.quadraticCurveTo(sx + 8, sy + 8, sx, sy + s);
  ctx.quadraticCurveTo(sx - 8, sy + 8, sx - s, sy);
  ctx.quadraticCurveTo(sx - 8, sy - 8, sx, sy - s);
  ctx.fillStyle = "#1c2236";
  ctx.fill();
  ctx.fillStyle = "#e9be62";
  ctx.font = `600 46px ${FONT_DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("BoardDream", CW / 2, CH / 2 + 172);
  back = texture(canvas);
  return back;
}

// ---------- Table ----------

let wood: { map: Texture; bump: Texture } | undefined;

/** Light oak planks: long wavy grain lines, slow color drift along each plank, thin seams. */
export function woodTextures(): { map: Texture; bump: Texture } {
  if (wood) return wood;
  const size = 1024;
  const plank = 128;
  const [canvas, ctx] = canvas2d(size, size);
  const [bumpCanvas, bctx] = canvas2d(size, size);
  const image = ctx.createImageData(size, size);
  const bump = bctx.createImageData(size, size);
  const drift = noise2(11, 4, 64);
  const wave = noise2(23, 8, 32);
  const fine = noise2(37, 128, 1024);
  const tones = Array.from({ length: size / plank }, (_, i) => seeded(i + 3)() * 0.2 - 0.1);
  const offsets = Array.from({ length: size / plank }, (_, i) => Math.floor(seeded(i + 99)() * size));
  const dark = [176, 136, 96];
  const light = [234, 208, 170];
  for (let y = 0; y < size; y++) {
    const p = Math.floor(y / plank);
    const ly = y % plank;
    const fy = y / size;
    for (let x = 0; x < size; x++) {
      const sx = ((x + offsets[p]) % size) / size;
      const d = drift(sx * 4, fy * 64);
      const w = wave(sx * 8, fy * 32);
      // Grain: many thin lines along the plank whose phase wanders slowly.
      const g = Math.sin((fy * 260 + w * 5 + d * 2) * Math.PI * 2);
      const line = Math.max(0, g - 0.55) / 0.45;
      let v = 0.6 + tones[p] + (d - 0.5) * 0.36 - line * 0.2 + (fine(sx * 128, fy * 1024) - 0.5) * 0.1;
      if (ly < 2 || ly > plank - 2) v *= 0.55;
      v = Math.min(1, Math.max(0, v));
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) image.data[i + c] = dark[c] + (light[c] - dark[c]) * v;
      image.data[i + 3] = 255;
      bump.data[i] = bump.data[i + 1] = bump.data[i + 2] = 255 * (v - line * 0.2);
      bump.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  bctx.putImageData(bump, 0, 0);
  const map = texture(canvas);
  const bumpMap = texture(bumpCanvas, false);
  for (const t of [map, bumpMap]) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(3, 3);
  }
  wood = { map, bump: bumpMap };
  return wood;
}

// ---------- Mats, glows and labels ----------

const mats = new Map<string, CanvasTexture>();
const PX = 24;

export const NAVY = "#24304a";
export const GOLD_INK = "#e3b65c";

/** Seat mats are pastel cloth with a band in the seat color; shared supplies are a navy board with gold trim. */
export function matTexture(width: number, depth: number, color: string, title: string, shared: boolean): CanvasTexture {
  const key = [width.toFixed(1), depth.toFixed(1), color, title, shared].join("|");
  return cached(mats, key, () => {
    const scale = Math.min(PX, 2048 / width);
    const [canvas, ctx] = canvas2d(width * scale, depth * scale);
    const w = canvas.width;
    const h = canvas.height;
    const u = scale;
    roundRect(ctx, 0, 0, w, h, 0.7 * u);
    ctx.save();
    ctx.clip();
    const base = shared ? NAVY : mix(color, "#f6f1e7", 0.82);
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    bg.addColorStop(0, mix(base, "#ffffff", shared ? 0.08 : 0.25));
    bg.addColorStop(1, mix(base, "#000000", shared ? 0.18 : 0.04));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // Woven cloth.
    ctx.strokeStyle = shared ? "rgba(255, 255, 255, 0.025)" : "rgba(60, 40, 20, 0.035)";
    ctx.lineWidth = 1;
    for (let i = 0; i < w + h; i += 5) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - h, h);
      ctx.stroke();
    }
    ctx.globalAlpha = shared ? 0.5 : 0.35;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    if (shared) {
      ctx.fillStyle = "rgba(227, 182, 92, 0.85)";
      ctx.fillRect(1.2 * u, 3 * u - 1, w - 2.4 * u, 2);
    } else {
      const band = ctx.createLinearGradient(0, 0, 0, 3 * u);
      band.addColorStop(0, mix(color, "#ffffff", 0.08));
      band.addColorStop(1, mix(color, "#000000", 0.06));
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, w, 3 * u);
    }
    ctx.restore();
    // Stitched edge.
    roundRect(ctx, 0.45 * u, 0.45 * u, w - 0.9 * u, h - 0.9 * u, 0.45 * u);
    ctx.setLineDash([0.45 * u, 0.3 * u]);
    ctx.lineWidth = Math.max(2, 0.08 * u);
    ctx.strokeStyle = shared ? alpha(GOLD_INK, 0.7) : alpha(mix(color, "#000000", 0.15), 0.45);
    ctx.stroke();
    ctx.setLineDash([]);
    // Name.
    ctx.fillStyle = shared ? GOLD_INK : "#ffffff";
    ctx.font = `600 ${1.25 * u}px ${FONT_DISPLAY}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = 0.15 * u;
    ctx.shadowOffsetY = 0.05 * u;
    ctx.fillText(title, 1.4 * u, 1.58 * u);
    ctx.shadowColor = "transparent";
    return texture(canvas);
  });
}

const glows = new Map<string, CanvasTexture>();

/** White soft-edged rounded rect, `blur` units of falloff around a `w` x `h` core; more passes, denser glow. */
export function glowTexture(w: number, h: number, blur: number, radius: number, passes = 1): CanvasTexture {
  const key = [w, h, blur, radius, passes].map((n) => n.toFixed(1)).join("|");
  return cached(glows, key, () => {
    const scale = Math.min(16, 1024 / (w + 2 * blur));
    const [canvas, ctx] = canvas2d((w + 2 * blur) * scale, (h + 2 * blur) * scale);
    for (let i = 0; i < passes; i++) softRect(ctx, blur * scale, blur * scale, w * scale, h * scale, radius * scale, "#ffffff", blur * scale * 0.9);
    return texture(canvas);
  });
}

let blob: CanvasTexture | undefined;

/** Soft round shadow for tokens and pieces. */
export function blobTexture(): CanvasTexture {
  if (blob) return blob;
  const [canvas, ctx] = canvas2d(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255, 255, 255, 1)");
  g.addColorStop(0.45, "rgba(255, 255, 255, 0.6)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  blob = texture(canvas);
  return blob;
}

let ring: CanvasTexture | undefined;

export function ringTexture(): CanvasTexture {
  if (ring) return ring;
  const [canvas, ctx] = canvas2d(256, 256);
  const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
  g.addColorStop(0, "rgba(255, 255, 255, 0)");
  g.addColorStop(0.62, "rgba(255, 255, 255, 0.15)");
  g.addColorStop(0.74, "rgba(255, 255, 255, 1)");
  g.addColorStop(0.8, "rgba(255, 255, 255, 0.35)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ring = texture(canvas);
  return ring;
}

const centroid = (polygon: [number, number][]): [number, number] => [
  polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length,
  polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length,
];

/**
 * Printed over the whole board slab: a gold inlay line in the margin, then cell labels (ink on
 * tiles, cream on the board itself for text-only cells). `margin` is in geometry units.
 */
/** Line height of two-line board labels, in font sizes. */
const LINE = 1.1;

export function boardPrint(geometry: Geometry, margin: number): CanvasTexture {
  const w = geometry.width + 2 * margin;
  const h = geometry.height + 2 * margin;
  const scale = 2048 / Math.max(w, h);
  const [canvas, ctx] = canvas2d(w * scale, h * scale);
  const inset = margin * 0.45 * scale;
  roundRect(ctx, inset, inset, canvas.width - 2 * inset, canvas.height - 2 * inset, inset * 0.6);
  ctx.lineWidth = Math.max(2, scale * 0.025);
  ctx.strokeStyle = "rgba(233, 190, 98, 0.55)";
  ctx.stroke();
  roundRect(ctx, inset * 1.35, inset * 1.35, canvas.width - 2.7 * inset, canvas.height - 2.7 * inset, inset * 0.4);
  ctx.lineWidth = Math.max(1, scale * 0.01);
  ctx.strokeStyle = "rgba(233, 190, 98, 0.25)";
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const span = (values: number[]) => Math.max(...values) - Math.min(...values);
  const widthOf = (cell: Geometry["cells"][number]) => span(cell.polygon.map(([x]) => x));
  // Text sizes are tuned for cells about one unit wide; boards drawn in bigger units scale them up.
  const tiles = geometry.cells.filter((c) => c.kind !== "label").map(widthOf).sort((a, b) => a - b);
  const unit = Math.max(1, tiles[Math.floor(tiles.length / 2)] ?? 1);
  for (const cell of geometry.cells) {
    if (!cell.label) continue;
    const [cx, cy] = centroid(cell.polygon);
    const isLabel = cell.kind === "label";
    const width = (isLabel ? 0.95 : 0.8) * widthOf(cell) * scale;
    const height = 0.8 * span(cell.polygon.map(([, y]) => y)) * scale;
    const cap = (isLabel ? 0.42 : 0.3) * unit * scale;
    // As big as the cap allows inside the cell, on one line or split in two at a space.
    ctx.font = `600 100px ${FONT_DISPLAY}`;
    let best = { lines: [cell.label], size: Math.min(cap, (width / Math.max(1, ctx.measureText(cell.label).width)) * 100) };
    const words = cell.label.split(" ");
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
      const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
      const size = Math.min(cap, (width / Math.max(1, widest)) * 100, height / (2 * LINE));
      if (size > best.size * 1.15) best = { lines, size };
    }
    ctx.font = `600 ${best.size}px ${FONT_DISPLAY}`;
    ctx.fillStyle = isLabel ? CREAM : alpha(INK, 0.85);
    best.lines.forEach((line, i) => {
      const dy = (i - (best.lines.length - 1) / 2) * LINE * best.size;
      ctx.fillText(line, (cx + margin) * scale, (cy + margin) * scale + dy);
    });
  }
  return texture(canvas);
}

const pieceLabels = new Map<string, CanvasTexture>();

export function pieceLabel(label: string): CanvasTexture {
  return cached(pieceLabels, label, () => {
    const [canvas, ctx] = canvas2d(128, 128);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitFont(ctx, label, 104, 84, 30, (size) => `700 ${size}px ${FONT_DISPLAY}`);
    ctx.fillText(label, 64, 70);
    return texture(canvas);
  });
}
