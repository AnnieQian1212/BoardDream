import type { CardView, Geometry, ResourceSpec } from "@boarddream/engine";
import type { LucideIcon } from "lucide-react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { iconFor, tagStyle } from "../icons";
import { inside } from "./growth";
import {
  alpha,
  canvas2d,
  drawIcon,
  fitFont,
  FONT_DISPLAY,
  FONT_UI,
  grainPattern,
  hash,
  hexPath,
  INK,
  inkedText,
  mix,
  roundRect,
  seeded,
  softRect,
  wrap,
} from "./paint";

/** Card face pixels; the 600 x 838 canvas matches the 63 x 88 mm card the scene uses. */
const CW = 600;
const CH = 838;

function texture(canvas: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
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

  // Card stock, framed in ink with a band of the card's tag color.
  const paper = ctx.createLinearGradient(0, 0, 0, CH);
  paper.addColorStop(0, "#faf2df");
  paper.addColorStop(1, "#f1e3c5");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, CW, CH);
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, CW, CH);
  roundRect(ctx, 20, 20, CW - 40, CH - 40, 24);
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  roundRect(ctx, 30, 30, CW - 60, CH - 60, 17);
  ctx.lineWidth = 6;
  ctx.strokeStyle = alpha(tag, 0.55);
  ctx.stroke();

  // Illustration window.
  const [ax, ay, aw, ah] = [42, 120, CW - 84, 352];
  ctx.save();
  roundRect(ctx, ax, ay, aw, ah, 14);
  ctx.clip();
  if (art) {
    // Painted art leaves a wide paper margin; zoom in so the subject fills the window.
    const s = Math.max(aw / art.width, ah / art.height) * 1.3;
    ctx.drawImage(art, ax + (aw - art.width * s) / 2, ay + (ah - art.height * s) / 2, art.width * s, art.height * s);
  } else {
    paintWash(ctx, tag, icon, ax, ay, aw, ah, hash(card.title));
  }
  const vignette = ctx.createRadialGradient(ax + aw / 2, ay + ah / 2, ah * 0.4, ax + aw / 2, ay + ah / 2, aw * 0.75);
  vignette.addColorStop(0, "rgba(45, 32, 22, 0)");
  vignette.addColorStop(1, "rgba(45, 32, 22, 0.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(ax, ay, aw, ah);
  ctx.restore();
  roundRect(ctx, ax, ay, aw, ah, 14);
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // Cost pills, top left: flat color, inked edge, white figures with an ink rim.
  const pillW = Math.min(112, (CW - 200 - 10 * (costs.length - 1)) / Math.max(1, costs.length));
  costs.forEach(([id, n], i) => {
    const res = resources.get(id);
    const color = res?.color ?? "#7d8a84";
    const x = 42 + i * (pillW + 10);
    roundRect(ctx, x, 40, pillW, 62, 31);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    drawIcon(ctx, iconFor(res?.icon), x + 31, 71, 32, "#ffffff", 2.5);
    ctx.font = `800 34px ${FONT_UI}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    inkedText(ctx, String(n), x + pillW - 28, 73, 6);
  });

  // Points, top right: an ochre hexagon.
  if (card.points) {
    const [cx, cy, r] = [CW - 82, 71, 46];
    hexPath(ctx, cx, cy, r);
    ctx.fillStyle = "#e7b54f";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    hexPath(ctx, cx, cy, r - 9);
    ctx.lineWidth = 2;
    ctx.strokeStyle = alpha(INK, 0.35);
    ctx.stroke();
    ctx.fillStyle = INK;
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
    roundRect(ctx, bx, by, bw, bh, 14);
    ctx.fillStyle = alpha(tag, 0.1);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = alpha(INK, 0.45);
    ctx.stroke();
    let size = 31;
    let lines: string[] = [];
    for (; size >= 19; size--) {
      ctx.font = `500 ${size}px ${FONT_UI}`;
      lines = wrap(ctx, card.text, bw - 44);
      if (lines.length * size * 1.3 <= bh - 30) break;
    }
    ctx.fillStyle = mix(INK, "#6b5a45", 0.4);
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

const BACK = "#4d6b4a";

/** Forest green stock scattered with inked leaves, a cream frame and the brand hexagon. */
export function cardBack(): CanvasTexture {
  if (back) return back;
  const [canvas, ctx] = canvas2d(CW, CH);
  const bg = ctx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, CH * 0.62);
  bg.addColorStop(0, mix(BACK, "#ffffff", 0.08));
  bg.addColorStop(1, mix(BACK, INK, 0.2));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);
  const rand = seeded(41);
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 10; col++) {
      const x = col * 64 + (row % 2) * 32 + (rand() - 0.5) * 14;
      const y = row * 62 + (rand() - 0.5) * 14;
      leaf(ctx, x, y, 17 + rand() * 7, rand() * Math.PI * 2, mix(BACK, INK, 0.38));
    }
  }
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, CW, CH);
  ctx.globalAlpha = 1;
  roundRect(ctx, 24, 24, CW - 48, CH - 48, 20);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#f1e3c2";
  ctx.stroke();
  roundRect(ctx, 38, 38, CW - 76, CH - 76, 13);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(241, 227, 194, 0.55)";
  ctx.stroke();
  // A clearing in the leaves for the emblem.
  const [cx, cy] = [CW / 2, CH / 2 - 20];
  const clearing = ctx.createRadialGradient(cx, cy, 120, cx, cy, 175);
  clearing.addColorStop(0, BACK);
  clearing.addColorStop(1, alpha(BACK, 0));
  ctx.fillStyle = clearing;
  ctx.fillRect(cx - 180, cy - 180, 360, 360);
  hexPath(ctx, cx, cy, 116);
  ctx.fillStyle = "#e7b54f";
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = INK;
  ctx.stroke();
  hexPath(ctx, cx, cy, 100);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = alpha(INK, 0.4);
  ctx.stroke();
  ctx.beginPath();
  const s = 60;
  ctx.moveTo(cx, cy - s);
  ctx.quadraticCurveTo(cx + 8, cy - 8, cx + s, cy);
  ctx.quadraticCurveTo(cx + 8, cy + 8, cx, cy + s);
  ctx.quadraticCurveTo(cx - 8, cy + 8, cx - s, cy);
  ctx.quadraticCurveTo(cx - 8, cy - 8, cx, cy - s);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.font = `600 46px ${FONT_DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  inkedText(ctx, "BoardDream", CW / 2, CH / 2 + 172, 8, "#f1e3c2");
  back = texture(canvas);
  return back;
}

/** A pointed leaf with a midrib, `size` pixels long. */
function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-size, 0);
  ctx.quadraticCurveTo(0, -size * 0.55, size, 0);
  ctx.quadraticCurveTo(0, size * 0.55, -size, 0);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-size * 1.25, 0);
  ctx.lineTo(size * 0.7, 0);
  ctx.lineWidth = 2;
  ctx.strokeStyle = mix(color, "#ffffff", 0.2);
  ctx.stroke();
  ctx.restore();
}

// ---------- Table ----------

let wood: Texture | undefined;

/**
 * Honey planks drawn like an illustration: a flat tone per plank, a few hand-inked grain lines and
 * knots, inked seams. Every line repeats across the width, so the texture tiles.
 */
export function tableTexture(): Texture {
  if (wood) return wood;
  const size = 1024;
  const plank = 128;
  const [canvas, ctx] = canvas2d(size, size);
  const rand = seeded(5);
  const curve = (y: number, waves: { amp: number; k: number; phase: number }[]) => {
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const dy = waves.reduce((sum, w) => sum + w.amp * Math.sin((2 * Math.PI * w.k * x) / size + w.phase), 0);
      if (x === 0) ctx.moveTo(x, y + dy);
      else ctx.lineTo(x, y + dy);
    }
    ctx.stroke();
  };
  for (let p = 0; p < size / plank; p++) {
    const top = p * plank;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, size, plank);
    ctx.clip();
    const tone = mix("#ebcd9c", "#d8b07a", 0.15 + rand() * 0.55);
    const fill = ctx.createLinearGradient(0, top, 0, top + plank);
    fill.addColorStop(0, mix(tone, "#fff4dc", 0.12));
    fill.addColorStop(1, mix(tone, "#a87a45", 0.08));
    ctx.fillStyle = fill;
    ctx.fillRect(0, top, size, plank);
    // Grain: long, gently wavy strokes.
    ctx.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      ctx.lineWidth = 1 + rand() * 1.8;
      ctx.strokeStyle = alpha(INK, 0.07 + rand() * 0.12);
      curve(top + 8 + rand() * (plank - 16), [
        { amp: 2 + rand() * 4, k: 1 + Math.floor(rand() * 3), phase: rand() * 6.3 },
        { amp: rand() * 2, k: 4 + Math.floor(rand() * 4), phase: rand() * 6.3 },
      ]);
    }
    // A knot now and then, drawn again a width away so it wraps.
    if (rand() < 0.3) {
      const [kx, ky] = [rand() * size, top + 30 + rand() * (plank - 60)];
      for (const ox of [-size, 0, size]) {
        for (let ring = 0; ring < 3; ring++) {
          ctx.beginPath();
          ctx.ellipse(kx + ox, ky, 9 + ring * 9, 3.5 + ring * 3.5, 0, 0, Math.PI * 2);
          ctx.lineWidth = ring === 0 ? 2.5 : 1.4;
          ctx.strokeStyle = alpha(INK, ring === 0 ? 0.2 : 0.1);
          ctx.stroke();
        }
      }
    }
    // Where two boards meet end to end.
    const joint = rand() * size;
    ctx.beginPath();
    ctx.moveTo(joint, top + 3);
    ctx.lineTo(joint, top + plank - 3);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = alpha(INK, 0.18);
    ctx.stroke();
    ctx.restore();
    // Seam: an ink line with a lit edge below it.
    ctx.fillStyle = alpha(INK, 0.32);
    ctx.fillRect(0, top, size, 2.5);
    ctx.fillStyle = "rgba(255, 246, 225, 0.35)";
    ctx.fillRect(0, top + 2.5, size, 1.5);
  }
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;
  wood = texture(canvas);
  wood.wrapS = wood.wrapT = RepeatWrapping;
  wood.repeat.set(3, 3);
  return wood;
}

// ---------- Mats, glows and labels ----------

const mats = new Map<string, CanvasTexture>();
const PX = 24;

/** Printed card stock: seat mats, shared supply boards and the board's slab, and their cut edges. */
export const PARCHMENT = "#f6ead0";
export const SUPPLY = "#ecdbb3";
export const BOARD = "#ecdcb3";
export const KRAFT = "#c9a46c";

/**
 * Seat mats are parchment with a header in the seat color; shared supplies are a kraft-toned board
 * with an inked rule under the name. Both have an inked border, like a printed player board.
 */
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
    const base = shared ? SUPPLY : mix(color, PARCHMENT, 0.86);
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    bg.addColorStop(0, mix(base, "#ffffff", 0.18));
    bg.addColorStop(1, mix(base, "#8a6a40", 0.06));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    const rule = Math.max(2, 0.07 * u);
    if (!shared) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, 3 * u);
    }
    ctx.fillStyle = INK;
    if (shared) ctx.fillRect(1.2 * u, 3 * u - rule / 2, w - 2.4 * u, rule);
    else ctx.fillRect(0, 3 * u - rule / 2, w, rule);
    ctx.restore();
    // Inked border.
    roundRect(ctx, 0.45 * u, 0.45 * u, w - 0.9 * u, h - 0.9 * u, 0.45 * u);
    ctx.lineWidth = Math.max(2, 0.06 * u);
    ctx.strokeStyle = alpha(INK, 0.75);
    ctx.stroke();
    // Name.
    ctx.font = `600 ${1.25 * u}px ${FONT_DISPLAY}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    if (shared) {
      ctx.fillStyle = INK;
      ctx.fillText(title, 1.4 * u, 1.58 * u);
    } else inkedText(ctx, title, 1.4 * u, 1.58 * u, Math.max(3, 0.16 * u));
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
 * Printed over the whole board slab: an inked frame in the margin, then cell labels, in ink on the
 * tiles and on the board itself for text-only cells. `margin` is in geometry units.
 */
/** Line height of two-line board labels, in font sizes. */
const LINE = 1.1;
/** Corners and edge midpoints of a label's box, which must all lie inside its cell. */
const BOX = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

export function boardPrint(geometry: Geometry, margin: number): CanvasTexture {
  const w = geometry.width + 2 * margin;
  const h = geometry.height + 2 * margin;
  const scale = 2048 / Math.max(w, h);
  const [canvas, ctx] = canvas2d(w * scale, h * scale);
  const inset = margin * 0.45 * scale;
  roundRect(ctx, inset, inset, canvas.width - 2 * inset, canvas.height - 2 * inset, inset * 0.6);
  ctx.lineWidth = Math.max(2.5, scale * 0.03);
  ctx.strokeStyle = alpha(INK, 0.7);
  ctx.stroke();
  roundRect(ctx, inset * 1.35, inset * 1.35, canvas.width - 2.7 * inset, canvas.height - 2.7 * inset, inset * 0.4);
  ctx.lineWidth = Math.max(1.5, scale * 0.012);
  ctx.strokeStyle = alpha(INK, 0.35);
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
    // The text stays inside the cell's own shape (a wedge, a hex), shrunk toward its center, not
    // merely inside its bounding box.
    const share = isLabel ? 0.95 : 0.8;
    const area = cell.polygon.map(([x, y]): [number, number] => [(cx + (x - cx) * share + margin) * scale, (cy + (y - cy) * share + margin) * scale]);
    const [px, py] = [(cx + margin) * scale, (cy + margin) * scale];
    const fits = (lines: string[], size: number) => {
      ctx.font = `600 ${size}px ${FONT_DISPLAY}`;
      const halfW = Math.max(...lines.map((line) => ctx.measureText(line).width)) / 2;
      const halfH = ((lines.length - 1) * LINE * size) / 2 + 0.42 * size;
      return BOX.every(([sx, sy]) => inside(area, px + sx * halfW, py + sy * halfH));
    };
    // Measured at the size it is drawn: the display font's letters widen as they get smaller.
    const largest = (lines: string[], from: number) => {
      let size = from;
      while (size > 4 && !fits(lines, size)) size *= 0.94;
      return size;
    };
    const width = widthOf(cell) * share * scale;
    // Status text on the board itself grows more slowly with the cells than tile names do.
    const cap = (isLabel ? 0.42 * Math.sqrt(unit) : 0.3 * unit) * scale;
    // As big as the cap allows inside the cell, on one line or split in two at a space.
    ctx.font = `600 100px ${FONT_DISPLAY}`;
    const guess = (lines: string[]) => Math.min(cap, (width / Math.max(1, ...lines.map((line) => ctx.measureText(line).width))) * 100);
    let best = { lines: [cell.label], size: largest([cell.label], guess([cell.label])) };
    const words = cell.label.split(" ");
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
      ctx.font = `600 100px ${FONT_DISPLAY}`;
      const size = largest(lines, guess(lines));
      if (size > best.size * 1.15) best = { lines, size };
    }
    ctx.font = `600 ${best.size}px ${FONT_DISPLAY}`;
    ctx.fillStyle = isLabel ? INK : alpha(INK, 0.85);
    best.lines.forEach((line, i) => {
      const dy = (i - (best.lines.length - 1) / 2) * LINE * best.size;
      ctx.fillText(line, px, py + dy);
    });
  }
  return texture(canvas);
}

const pieceLabels = new Map<string, CanvasTexture>();

export function pieceLabel(label: string): CanvasTexture {
  return cached(pieceLabels, label, () => {
    const [canvas, ctx] = canvas2d(128, 128);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitFont(ctx, label, 96, 80, 30, (size) => `700 ${size}px ${FONT_DISPLAY}`);
    inkedText(ctx, label, 64, 70, 10);
    return texture(canvas);
  });
}
