import type { CardView, Geometry, ResourceSpec } from "@boarddream/engine";
import type { LucideIcon } from "lucide-react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { cardType, iconFor, tagStyle } from "../icons";
import { motifFor } from "../motifs";
import { RIM_INK, TILE_SHARE, zoneColors } from "./ground";
import { isWaterCell } from "./water";
import { sizeGroups, uniformSizes } from "../sizeGroups";
import { growthsOf, inside, type PrintBox } from "./growth";
import { MAT_TITLE } from "./layout";
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
  // Text on cards, mats and the board is often seen at a slant; three caps this at what the GPU allows.
  t.anisotropy = 16;
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
    paintVignette(ctx, tag, motifFor(card.title) ?? icon, ax, ay, aw, ah, hash(card.title));
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
    // Centred lines keep clear of the type stamp in the bottom left corner, and so of the right too.
    const room = bw - 44 - (card.tags?.length ? 2 * STAMP.clear : 0);
    for (; size >= 19; size--) {
      ctx.font = `500 ${size}px ${FONT_UI}`;
      lines = wrap(ctx, card.text, room);
      if (lines.length * size * 1.3 <= bh - 30) break;
    }
    ctx.fillStyle = mix(INK, "#6b5a45", 0.4);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lh = size * 1.3;
    const top = by + bh / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => ctx.fillText(line, CW / 2, top + i * lh));
  }

  // The card's type at a glance (cardType: a guild, cargo, a survey), stamped in its color on the
  // bottom left corner, on painted cards (whose painting hides the drawn emblem) as on drawn ones.
  const type = cardType(card.tags);
  if (type) {
    const { x, y, r } = STAMP;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = type.color;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r - 7, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = alpha("#ffffff", 0.45);
    ctx.stroke();
    drawIcon(ctx, type.icon, x, y, r * 1.05, "#ffffff", 2.6);
  }
}

/** The type stamp on a card's bottom left corner, over the frame, and how far text keeps from the box's sides for it. */
const STAMP = { x: 64, y: CH - 64, r: 36, clear: 44 };

/**
 * Placeholder illustration until card art is painted, in the table's storybook style: a little
 * inked landscape (sky, a sun or a moon, a cloud, two rolling hills with grass) in the card's tag
 * color, and in front of it a round emblem with the card's motif (motifs.ts: a ship for a ferry, a
 * crown for a baron) drawn in ink and color, with a few sparkles. Seeded by the title, so every
 * card differs and stays the same.
 */
function paintVignette(ctx: CanvasRenderingContext2D, tag: string, icon: LucideIcon, x: number, y: number, w: number, h: number, seed: number) {
  const rand = seeded(seed);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Sky.
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, mix(tag, "#fff9ea", 0.8));
  sky.addColorStop(0.7, mix(tag, "#f6ead0", 0.62));
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  // A sun with short rays, or a crescent moon.
  const night = rand() < 0.35;
  const [sx, sy, sr] = [x + w * (rand() < 0.5 ? 0.18 + rand() * 0.12 : 0.7 + rand() * 0.12), y + h * (0.2 + rand() * 0.06), h * 0.085];
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  if (night) {
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.arc(sx + sr * 0.45, sy - sr * 0.2, sr * 0.85, 0, Math.PI * 2, true);
    ctx.fillStyle = "#f6ebc9";
    ctx.fill("evenodd");
    ctx.stroke();
    for (let i = 0; i < 4; i++) sparkle(ctx, x + w * (0.1 + rand() * 0.8), y + h * (0.08 + rand() * 0.25), 5 + rand() * 4, "#fbf3e1");
  } else {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * sr * 1.3, sy + Math.sin(a) * sr * 1.3);
      ctx.lineTo(sx + Math.cos(a) * sr * 1.65, sy + Math.sin(a) * sr * 1.65);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = "#f2c95e";
    ctx.fill();
    ctx.stroke();
  }
  // A cloud on the other side of the sky.
  const cloudX = sx < x + w / 2 ? x + w * (0.62 + rand() * 0.18) : x + w * (0.12 + rand() * 0.16);
  cloud(ctx, cloudX, y + h * (0.16 + rand() * 0.1), h * 0.07);
  // Two rolling hills, inked along their tops; the near one has tufts of grass.
  const hill = (base: number, amp: number, fill: string, tufts: boolean) => {
    const phase = rand() * Math.PI * 2;
    const k = 1 + rand() * 1.5;
    const top = (px: number) => base + Math.sin(((px - x) / w) * Math.PI * k + phase) * amp + Math.sin(((px - x) / w) * Math.PI * 5 + phase * 2) * amp * 0.25;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + h + 4);
    for (let px = x - 4; px <= x + w + 4; px += 6) ctx.lineTo(px, top(px));
    ctx.lineTo(x + w + 4, y + h + 4);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.beginPath();
    for (let px = x - 4; px <= x + w + 4; px += 6) (px === x - 4 ? ctx.moveTo(px, top(px)) : ctx.lineTo(px, top(px)));
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    if (!tufts) return;
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = alpha(INK, 0.55);
    for (let i = 0; i < 16; i++) {
      const px = x + rand() * w;
      const py = top(px) + 10 + rand() * (y + h - top(px) - 14);
      for (const a of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.sin(a) * 9, py - Math.cos(a) * 11);
        ctx.stroke();
      }
    }
  };
  hill(y + h * 0.58, h * 0.07, mix(tag, "#e8d9b4", 0.45), false);
  hill(y + h * 0.74, h * 0.05, mix(mix(tag, "#6f9a55", 0.35), "#efe2c4", 0.15), true);
  // The emblem: a cream medallion ringed in ink and the tag color, with a soft shadow.
  const [cx, cy, r] = [x + w / 2, y + h * 0.5, h * 0.31];
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.08, cy + r * 1.02, r * 0.95, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = alpha(INK, 0.16);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#fbf3e1";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 11, 0, Math.PI * 2);
  ctx.lineWidth = 9;
  ctx.strokeStyle = mix(tag, "#ffffff", 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 17, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = alpha(INK, 0.6);
  ctx.stroke();
  const glow = ctx.createRadialGradient(cx, cy - r * 0.3, 0, cx, cy, r - 18);
  glow.addColorStop(0, "rgba(255, 252, 240, 0.9)");
  glow.addColorStop(1, alpha(mix(tag, "#fbf3e1", 0.75), 0.9));
  ctx.beginPath();
  ctx.arc(cx, cy, r - 18, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
  // The motif, inked thick with the color inside, like a hand-colored print.
  const size = r * 1.12;
  drawIcon(ctx, icon, cx + 2, cy + 3, size, alpha(INK, 0.18), 3.6);
  drawIcon(ctx, icon, cx, cy, size, INK, 3.4);
  drawIcon(ctx, icon, cx, cy, size, mix(tag, "#ffffff", 0.08), 1.7);
  // Sparkles about the emblem.
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI * (0.15 + rand() * 0.7) + (i === 2 ? Math.PI : 0);
    sparkle(ctx, cx + Math.cos(a) * r * (1.3 + rand() * 0.2), cy + Math.sin(a) * r * (1.05 + rand() * 0.2), 7 + rand() * 5, "#f6dc8a");
  }
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** A four-pointed sparkle, inked. */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const d = i % 2 === 0 ? r : r * 0.32;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    else ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** A small inked cloud: a flat bottom under three bumps. */
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x - r * 2.2, y + r * 0.6);
  ctx.arc(x - r * 1.2, y + r * 0.1, r * 0.75, Math.PI * 0.9, Math.PI * 1.75);
  ctx.arc(x, y - r * 0.2, r, Math.PI * 1.15, Math.PI * 1.95);
  ctx.arc(x + r * 1.25, y + r * 0.15, r * 0.7, Math.PI * 1.3, Math.PI * 0.1);
  ctx.lineTo(x - r * 2.2, y + r * 0.6);
  ctx.closePath();
  ctx.fillStyle = "#fffaf0";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
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

const grounds = new Map<string, CanvasTexture>();

/**
 * A tile's ground painted in its color, storybook style: grass in light and dark strokes with
 * flowers on a meadow, moss, ferns and leaf litter under trees, furrowed rows in a field, cracks,
 * pebbles and lichen on stone, all over soft lighter and darker patches. Every mark is drawn again a
 * width away, so the texture tiles; one repeat spans about two cells.
 */
export function groundTexture(ground: "meadow" | "forest" | "field" | "rock", color: string): CanvasTexture {
  return cached(grounds, `${ground}:${color}`, () => {
    const size = 512;
    const [canvas, ctx] = canvas2d(size, size);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    const rand = seeded(hash(ground));
    const wrapped = (draw: (ox: number, oy: number) => void) => {
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) draw(ox, oy);
    };
    const light = mix(color, "#fff8d8", 0.32);
    const dark = mix(color, INK, 0.3);
    for (let i = 0; i < 30; i++) {
      const [x, y, r] = [rand() * size, rand() * size, 30 + rand() * 60];
      const tone = i % 2 ? light : dark;
      wrapped((ox, oy) => {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, alpha(tone, 0.45));
        g.addColorStop(1, alpha(tone, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r);
      });
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    /** Three to five short blades fanning up from one root. */
    const tuft = (x: number, y: number, length: number, stroke: string, width: number) => {
      const blades = 3 + Math.floor(rand() * 3);
      const fan = Array.from({ length: blades }, (_, b) => -0.75 + (1.5 * b) / (blades - 1) + (rand() - 0.5) * 0.3);
      wrapped((ox, oy) => {
        ctx.beginPath();
        for (const a of fan) {
          ctx.moveTo(x + ox, y + oy);
          ctx.quadraticCurveTo(x + ox + Math.sin(a) * length * 0.3, y + oy - length * 0.6, x + ox + Math.sin(a) * length * 0.75, y + oy - Math.cos(a) * length);
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.stroke();
      });
    };
    const dot = (x: number, y: number, r: number, fill: string, rim?: string) =>
      wrapped((ox, oy) => {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        if (rim) {
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = rim;
          ctx.stroke();
        }
      });
    if (ground === "meadow" || ground === "forest") {
      const meadow = ground === "meadow";
      // Grass in two tones, the dark tufts first so the sunlit ones sit on top.
      const deep = mix(color, "#24401a", meadow ? 0.45 : 0.5);
      const sunlit = mix(color, meadow ? "#eef5a8" : "#cfe39a", meadow ? 0.5 : 0.35);
      for (let i = 0; i < (meadow ? 90 : 60); i++) tuft(rand() * size, rand() * size, 17 + rand() * 10, alpha(deep, 0.8), 4.2);
      for (let i = 0; i < (meadow ? 80 : 34); i++) tuft(rand() * size, rand() * size, 15 + rand() * 9, alpha(sunlit, 0.9), 3.8);
      if (meadow) {
        // Flowers: a few small clusters of white, butter and pink.
        const petals = ["#fffaf0", "#f6dc7a", "#f2b4bd", "#fffaf0"];
        for (let c = 0; c < 14; c++) {
          const [x, y, petal] = [rand() * size, rand() * size, petals[c % petals.length]];
          for (let f = 0; f < 3; f++) dot(x + (rand() - 0.5) * 26, y + (rand() - 0.5) * 18, 4 + rand() * 1.6, petal, alpha(INK, 0.5));
        }
      } else {
        // Leaf litter and fern fronds under the trees.
        const leaf = mix(color, "#c69a3e", 0.55);
        for (let i = 0; i < 44; i++) {
          const [x, y, a] = [rand() * size, rand() * size, rand() * Math.PI * 2];
          wrapped((ox, oy) => {
            ctx.beginPath();
            ctx.ellipse(x + ox, y + oy, 8, 4, a, 0, Math.PI * 2);
            ctx.fillStyle = alpha(i % 3 ? leaf : mix(color, "#8a5a2a", 0.5), 0.8);
            ctx.fill();
          });
        }
        const frond = mix(color, "#1f3a18", 0.4);
        for (let i = 0; i < 14; i++) {
          const [x, y, a] = [rand() * size, rand() * size, -Math.PI / 2 + (rand() - 0.5) * 1.4];
          wrapped((ox, oy) => {
            ctx.beginPath();
            const [dx, dy] = [Math.cos(a), Math.sin(a)];
            ctx.moveTo(x + ox, y + oy);
            ctx.lineTo(x + ox + dx * 40, y + oy + dy * 40);
            for (let t = 0.25; t < 1; t += 0.15) {
              const [px, py] = [x + ox + dx * 40 * t, y + oy + dy * 40 * t];
              const reach = 14 * (1 - t * 0.7);
              ctx.moveTo(px, py);
              ctx.lineTo(px - dy * reach + dx * 3, py + dx * reach + dy * 3);
              ctx.moveTo(px, py);
              ctx.lineTo(px + dy * reach + dx * 3, py - dx * reach + dy * 3);
            }
            ctx.strokeStyle = alpha(frond, 0.85);
            ctx.lineWidth = 3.2;
            ctx.stroke();
          });
        }
      }
    } else if (ground === "field") {
      // Furrowed rows: a light ridge and a dark trough each, with stalks along the ridges.
      const rows = 10;
      const band = size / rows;
      for (let r = 0; r < rows; r++) {
        const y = r * band;
        const phase = rand() * Math.PI * 2;
        const wave = (x: number) => 2.5 * Math.sin((2 * Math.PI * 2 * x) / size + phase);
        for (const [offset, tone, width] of [
          [band * 0.3, alpha(light, 0.8), band * 0.34],
          [band * 0.78, alpha(dark, 0.5), band * 0.16],
        ] as const) {
          ctx.beginPath();
          for (let x = 0; x <= size; x += 8) {
            if (x === 0) ctx.moveTo(x, y + offset + wave(x));
            else ctx.lineTo(x, y + offset + wave(x));
          }
          ctx.strokeStyle = tone;
          ctx.lineWidth = width;
          ctx.stroke();
        }
        const stalk = mix(color, "#8a6424", 0.5);
        for (let d = 0; d < 16; d++) {
          const x = rand() * size;
          const at = y + band * 0.3 + wave(x);
          wrapped((ox) => {
            ctx.beginPath();
            ctx.moveTo(x + ox, at + 6);
            ctx.lineTo(x + ox + 3, at - 8);
            ctx.strokeStyle = alpha(stalk, 0.75);
            ctx.lineWidth = 3.2;
            ctx.stroke();
          });
        }
      }
      for (let i = 0; i < 8; i++) tuft(rand() * size, rand() * size, 16, alpha(mix(color, "#4f7a2c", 0.6), 0.75), 3.6);
    } else {
      // Pebbles with a lit top, lichen, then cracks that fork once.
      for (let i = 0; i < 46; i++) {
        const [x, y, r, a] = [rand() * size, rand() * size, 5 + rand() * 8, rand() * Math.PI];
        wrapped((ox, oy) => {
          ctx.beginPath();
          ctx.ellipse(x + ox, y + oy, r, r * 0.7, a, 0, Math.PI * 2);
          ctx.fillStyle = i % 2 ? light : mix(color, "#ffffff", 0.18);
          ctx.fill();
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = alpha(INK, 0.45);
          ctx.stroke();
        });
      }
      for (let i = 0; i < 22; i++) dot(rand() * size, rand() * size, 3.5 + rand() * 4, alpha(mix(color, "#b9b867", 0.6), 0.8));
      ctx.strokeStyle = alpha(INK, 0.45);
      ctx.lineWidth = 3.4;
      for (let i = 0; i < 9; i++) {
        let [x, y, a] = [rand() * size, rand() * size, rand() * Math.PI * 2];
        const points: [number, number][] = [[x, y]];
        for (let s = 0; s < 4 + Math.floor(rand() * 3); s++) {
          a += (rand() - 0.5) * 1.2;
          const step = 18 + rand() * 16;
          [x, y] = [x + Math.cos(a) * step, y + Math.sin(a) * step];
          points.push([x, y]);
        }
        const fork = points[1 + Math.floor(rand() * (points.length - 2))];
        const forkTo: [number, number] = [fork[0] + Math.cos(a + 1.2) * 24, fork[1] + Math.sin(a + 1.2) * 24];
        wrapped((ox, oy) => {
          ctx.beginPath();
          points.forEach(([px, py], j) => (j === 0 ? ctx.moveTo(px + ox, py + oy) : ctx.lineTo(px + ox, py + oy)));
          ctx.moveTo(fork[0] + ox, fork[1] + oy);
          ctx.lineTo(forkTo[0] + ox, forkTo[1] + oy);
          ctx.stroke();
        });
      }
    }
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, size, size);
    const t = texture(canvas);
    t.wrapS = t.wrapT = RepeatWrapping;
    return t;
  });
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
    // Name, large enough to read across the table; the layout leaves its header room by MAT_TITLE.
    // A supply hugs its cards, so a title longer than they are wide is printed smaller to fit.
    let titleSize = MAT_TITLE.size * u;
    ctx.font = `650 ${titleSize}px ${FONT_DISPLAY}`;
    const titleRoom = w - (MAT_TITLE.x + 1) * u;
    for (let i = 0; i < 12 && ctx.measureText(title).width > titleRoom; i++) {
      titleSize *= Math.max(0.8, (titleRoom / ctx.measureText(title).width) * 0.99);
      ctx.font = `650 ${titleSize}px ${FONT_DISPLAY}`;
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    if (shared) {
      ctx.fillStyle = INK;
      ctx.fillText(title, MAT_TITLE.x * u, MAT_TITLE.y * u);
    } else inkedText(ctx, title, MAT_TITLE.x * u, MAT_TITLE.y * u, Math.max(3, 0.16 * u));
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
/** The pale card a token is cut from, and the halo that keeps names legible on grass and water. */
const TOKEN = "#fbf3e1";

export interface BoardPrint {
  texture: CanvasTexture;
  /** Where each cell's name and token sit, by cell id, so grass can leave them clear. */
  boxes: Map<string, PrintBox>;
}

/**
 * Printed over the whole board slab: an inked frame in the margin, then cell names, in ink on the
 * tiles and on the board itself for text-only cells. A cell's badge (a yield, a cost) is not
 * printed: at the table's size its token could not be read, so the table shows it on hover. Names
 * keep clear of the pieces standing on their cell. `margin` is in geometry units.
 */
export function boardPrint(geometry: Geometry, margin: number, outlines?: Map<string, [number, number][]>): BoardPrint {
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
  ctx.lineJoin = "round";
  const span = (values: number[]) => Math.max(...values) - Math.min(...values);
  const widthOf = (cell: Geometry["cells"][number]) => span(cell.polygon.map(([x]) => x));
  // Text sizes are tuned for cells about one unit wide; boards drawn in bigger units scale them up.
  const tiles = geometry.cells.filter((c) => c.kind !== "label").map(widthOf).sort((a, b) => a - b);
  const unit = Math.max(1, tiles[Math.floor(tiles.length / 2)] ?? 1);
  const boxes = new Map<string, PrintBox>();
  const rimmed = zoneColors(geometry.cells);
  // Each place's area and bounds, to find the smaller places lying over part of a larger one (a pier
  // inside a stall's plot, a bridge across a river), whose tiles would hide its name.
  const areaOf = (polygon: [number, number][]) => Math.abs(polygon.reduce((sum, [x, y], i) => {
    const [nx, ny] = polygon[(i + 1) % polygon.length];
    return sum + x * ny - nx * y;
  }, 0)) / 2;
  const places = geometry.cells
    .filter((c) => c.kind !== "label")
    .map((c) => {
      const xs = c.polygon.map(([x]) => x);
      const ys = c.polygon.map(([, y]) => y);
      return { cell: c, area: areaOf(c.polygon), x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    });
  const overlap = (a: (typeof places)[number], b: (typeof places)[number]) =>
    Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const plans: { cell: Geometry["cells"][number]; isLabel: boolean; px: number; py: number; lines: string[]; size: number; drop: number; group?: string }[] = [];
  const sizeGroup = sizeGroups(geometry.cells);
  for (const cell of geometry.cells) {
    const isLabel = cell.kind === "label";
    if (!cell.label) continue;
    // Status text set over a place (Rustspire's round, on top of a wreck) would print over that
    // place's name; it is left off the board, and the panels carry it.
    if (isLabel) {
      const xs = cell.polygon.map(([x]) => x);
      const ys = cell.polygon.map(([, y]) => y);
      const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      const own = (box.x1 - box.x0) * (box.y1 - box.y0);
      if (places.some((p) => p.cell.kind !== "edge" && p.cell.kind !== "vertex" && overlap(p, box as never) > 0.2 * own)) continue;
    }
    const label = cell.label;
    // The text stays inside the cell's own shape (a wedge, a hex), not merely its bounding box, and
    // inside its color: the tile as drawn (`outlines`: already drawn in from the cell, and drawn back
    // from smaller neighbours), or within a group's rim the field inside the rim's inked line, with
    // a little margin. Text-only cells are the board itself.
    const drawn = isLabel ? undefined : outlines?.get(cell.id);
    const shape = drawn ?? cell.polygon;
    const [cx, cy] = centroid(shape);
    const share = isLabel ? 0.95 : (drawn ? 1 : TILE_SHARE) * (rimmed.has(cell.id) ? RIM_INK : 1) * 0.96;
    const area = shape.map(([x, y]): [number, number] => [(cx + (x - cx) * share + margin) * scale, (cy + (y - cy) * share + margin) * scale]);
    const [px, py] = [(cx + margin) * scale, (cy + margin) * scale];
    const within = (x: number, y: number, hw: number, hh: number) => BOX.every(([sx, sy]) => inside(area, x + sx * hw, y + sy * hh));
    // The pieces on this cell, as the ground they cover: a disc its own round, a standing figure
    // also the space behind it, which it hides from the camera.
    const pieces = isLabel
      ? []
      : geometry.pieces
          .filter((p) => p.cellId === cell.id || inside(cell.polygon, p.x, p.y))
          .map((p) => ({ x: (p.x + margin) * scale, y: (p.y + margin) * scale, r: p.r * 1.25 * scale, back: p.shape === "pawn" ? p.r * 2.6 * scale : 0 }));
    // Smaller places over a good part of this one, as boxes the name must keep off.
    const self = places.find((p) => p.cell === cell);
    const covers = !self
      ? []
      : places
          // Roads and building spots run along edges and corners, between places, not over their middles.
          .filter((o) => o !== self && o.cell.kind !== "edge" && o.cell.kind !== "vertex" && o.area < self.area && overlap(o, self) > 0.2 * (o.x1 - o.x0) * (o.y1 - o.y0))
          .map((o) => ({ x0: (o.x0 + margin) * scale, x1: (o.x1 + margin) * scale, y0: (o.y0 + margin) * scale, y1: (o.y1 + margin) * scale }));
    const clear = (x: number, y: number, hw: number, hh: number) =>
      covers.every((o) => x + hw < o.x0 || x - hw > o.x1 || y + hh < o.y0 || y - hh > o.y1) &&
      pieces.every((p) => {
        // Nearest point of the name's box to the piece's foot, and of the box to the space behind it.
        const dx = Math.max(Math.abs(p.x - x) - hw, 0);
        const dy = Math.max(Math.abs(p.y - y) - hh, 0);
        const behind = p.back > 0 && Math.abs(p.x - x) < hw + p.r && y + hh > p.y - p.back && y - hh < p.y;
        return dx * dx + dy * dy > p.r * p.r && !behind;
      });
    // The name's middle `drop` below the cell's center, for a name `size` tall.
    const place = (lines: string[], size: number, drop: number) => {
      const half = ((lines.length - 1) * LINE * size) / 2 + 0.42 * size;
      return { half, name: drop };
    };
    const measure = (lines: string[]) => Math.max(...lines.map((line) => ctx.measureText(line).width)) / 2;
    const fits = (lines: string[], size: number, drop: number, avoid = true) => {
      ctx.font = `600 ${size}px ${FONT_DISPLAY}`;
      const at = place(lines, size, drop);
      const hw = measure(lines);
      return within(px, py + at.name, hw, at.half) && (!avoid || clear(px, py + at.name, hw, at.half));
    };
    // Measured at the size it is drawn: the display font's letters widen as they get smaller.
    const largest = (lines: string[], from: number, drop: number, avoid: boolean) => {
      let size = from;
      while (size > 4 && !fits(lines, size, drop, avoid)) size *= 0.94;
      return size;
    };
    // A first guess at the size: the name across the whole of its color (grass and trees keep clear of it).
    const width = span(shape.map(([x]) => x)) * share * scale;
    // Status text on the board itself grows more slowly with the cells than tile names do.
    // A tile name's cap follows the usual tile, but never less than an eighth of the board's long
    // side: on a board of many small places (Saffron Wake's twelve harbors) the usual tile set every
    // name, the bays' too, at the smallest size that can be read.
    const cap = (isLabel ? 0.42 * Math.sqrt(unit) : 0.22 * Math.max(unit, Math.max(geometry.width, geometry.height) / 8)) * scale;
    // As big as the cap allows inside the cell, on one line or split in two at a space.
    ctx.font = `600 100px ${FONT_DISPLAY}`;
    const guess = (lines: string[]) => Math.min(cap, (width / Math.max(1, ...lines.map((line) => ctx.measureText(line).width))) * 100);
    const layout = (drop: number, avoid = true) => {
      let best = { lines: [label], size: largest([label], guess([label]), drop, avoid), drop };
      const words = label.split(" ");
      for (let i = 1; i < words.length; i++) {
        const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
        ctx.font = `600 100px ${FONT_DISPLAY}`;
        const size = largest(lines, guess(lines), drop, avoid);
        if (size > best.size * 1.15) best = { lines, size, drop };
      }
      return best;
    };
    // Where things grow, the print sits toward the tile's front like a caption, leaving the back
    // for trees and boulders, unless that would cost the name much of its size.
    const centered = layout(0);
    const lowered = !isLabel && growthsOf(cell).length > 0 ? layout(0.12 * unit * scale) : undefined;
    let best = lowered && lowered.size >= centered.size * 0.9 && fits(lowered.lines, lowered.size, lowered.drop) ? lowered : centered;
    if (pieces.length > 0 || covers.length > 0) {
      // A name a piece or another place would cover moves up or down its cell, to wherever it can
      // be largest. If nowhere leaves it half its size: under pieces it stays in the middle at full
      // size, partly hidden rather than too small to read; under other places' tiles, which would
      // print one name over another, it is left out (hovering the place still shows it).
      const tall = span(shape.map(([, y]) => y)) * scale;
      for (const share of [-0.3, 0.3, -0.2, 0.2, -0.38, 0.38]) {
        const moved = layout(share * tall);
        if (moved.size > best.size) best = moved;
      }
      const free = layout(0, false);
      if (best.size < free.size * 0.55) {
        if (covers.length > 0) continue;
        best = free;
      }
    }
    plans.push({ cell, isLabel, px, py, lines: best.lines, size: best.size, drop: best.drop, group: isLabel ? undefined : sizeGroup(cell) });
  }
  // Places of one kind and size print their names at one size: a row of stalls with names as large
  // as each could hold read as untidy, short names shouting. The size is that of the name with least
  // room, unless one name has far less than the rest (under three quarters of the middle one): that
  // name alone is printed smaller, rather than all of them.
  const groupSize = uniformSizes(plans.flatMap((p) => (p.group ? [{ group: p.group, size: p.size }] : [])));
  // A bare tile (no grass, trees, stone or water on it: an action space, an order, a stall) is
  // printed as a board marks its spaces: an inked frame inside its edge, and where its name leaves
  // room, the emblem of what it is (a scroll for an order, coins for a market) in ink to the name's
  // left. A row of plain slabs read as blank cards; an emblem faint behind the name read as a stain.
  const bare = new Map<string, { shape: [number, number][]; motif?: LucideIcon }>();
  for (const cell of geometry.cells) {
    if (cell.kind === "label" || cell.kind === "edge" || cell.kind === "vertex" || cell.segments || isWaterCell(cell) || growthsOf(cell).length > 0) continue;
    const shape = outlines?.get(cell.id) ?? cell.polygon;
    const [cx, cy] = centroid(shape);
    const side = Math.min(span(shape.map(([x]) => x)), span(shape.map(([, y]) => y)));
    const inset = 0.09 * side;
    ctx.beginPath();
    shape.forEach(([x, y], i) => {
      const d = Math.hypot(x - cx, y - cy) || 1;
      const [fx, fy] = [(x - ((x - cx) / d) * inset * Math.SQRT2 + margin) * scale, (y - ((y - cy) / d) * inset * Math.SQRT2 + margin) * scale];
      if (i === 0) ctx.moveTo(fx, fy);
      else ctx.lineTo(fx, fy);
    });
    ctx.closePath();
    ctx.lineWidth = Math.max(1.5, scale * 0.014);
    ctx.strokeStyle = alpha(INK, 0.32);
    ctx.stroke();
    bare.set(cell.id, { shape, motif: motifFor(cell.kind ?? "") ?? (cell.label ? motifFor(cell.label) : undefined) });
  }
  // A name smaller than this (on the 2048 px print, about 12 screen pixels on a laptop) cannot be
  // read: it is left off, and the place's hover tip names it (Saffron Wake's harbors, a fifth of a
  // bay across).
  const smallest = 24 * (Math.max(canvas.width, canvas.height) / 2048);
  for (const { cell, isLabel, px, py, lines, drop, group, size: own } of plans) {
    const size = group ? Math.min(own, groupSize.get(group)!) : own;
    if (!isLabel && size < smallest) continue;
    const plain = bare.get(cell.id);
    if (plain?.motif) {
      ctx.font = `600 ${size}px ${FONT_DISPLAY}`;
      const hw = Math.max(...lines.map((line) => ctx.measureText(line).width)) / 2;
      const x0 = (Math.min(...plain.shape.map(([x]) => x)) + margin) * scale;
      const tall = span(plain.shape.map(([, y]) => y)) * scale;
      const gap = px - hw - x0;
      const icon = Math.min(gap * 0.62, tall * 0.42);
      if (icon >= size * 0.7) drawIcon(ctx, plain.motif, x0 + gap * 0.5, py + drop, icon, alpha(INK, 0.55), Math.max(1.5, icon / 18));
    }
    const half = ((lines.length - 1) * LINE * size) / 2 + 0.42 * size;
    ctx.font = `600 ${size}px ${FONT_DISPLAY}`;
    lines.forEach((line, i) => {
      const y = py + drop + (i - (lines.length - 1) / 2) * LINE * size;
      // A pale halo keeps a tile's name legible on grass, stone or water, however busy the ground.
      if (!isLabel) {
        ctx.lineWidth = size * 0.26;
        ctx.lineJoin = "round";
        ctx.strokeStyle = alpha(TOKEN, 0.92);
        ctx.strokeText(line, px, y);
      }
      ctx.fillStyle = INK;
      ctx.fillText(line, px, y);
    });
    boxes.set(cell.id, {
      halfWidth: Math.max(...lines.map((line) => ctx.measureText(line).width)) / 2 / scale,
      top: (drop - half) / scale,
      bottom: (drop + half) / scale,
    });
  }
  return { texture: texture(canvas), boxes };
}

const pieceLabels = new Map<string, CanvasTexture>();

/**
 * What is cut into a piece: a short label (a number, initials) or for a word the motif it names (a
 * cap for a student, a briefcase for a commuter). A word itself would be a few unreadable pixels;
 * a word with no motif marks nothing, and the cell's hover tip names the piece.
 *
 * It is engraved and filled, as a game's wooden pieces are: the board's own serif cut into the wood,
 * its upper edge in shadow and its lower edge catching the light, the cut filled with ivory on a
 * dark or bright paint and with brown on a pale one. A label in a white-rimmed display face, then in
 * a bright flat sans, read as a sticker on the wood; stamped in a deeper tone of the paint, a blue
 * cube's "?" was too faint to read.
 */
export function pieceMark(label: string | undefined, color: string): CanvasTexture | undefined {
  if (!label) return undefined;
  const short = label.length <= 3;
  const motif = short ? undefined : motifFor(label);
  if (!short && !motif) return undefined;
  return cached(pieceLabels, `${label}|${color}`, () => {
    const [canvas, ctx] = canvas2d(128, 128);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
    const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const pale = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.33;
    const fill = pale ? "#3a2618" : "#fbf3e1";
    const lit = mix(color, "#ffffff", 0.5);
    const shade = mix(color, "#1c120a", 0.75);
    // The cut's upper edge in shadow and its lower edge in light, then the paint filling it.
    const stamp = (draw: (fill: string, dy: number) => void) => {
      draw(alpha(shade, 0.7), -2);
      draw(alpha(lit, 0.8), 2.2);
      draw(fill, 0);
    };
    if (motif) stamp((fill, dy) => drawIcon(ctx, motif, 64, 64 + dy, 64, fill, 4));
    else {
      // One size for every label (smaller only when three letters would not fit), centred on the
      // letters' own outline rather than the font's line box.
      fitFont(ctx, label, 112, 80, 30, (size) => `600 ${size}px ${FONT_DISPLAY}`);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      const m = ctx.measureText(label);
      const x = 64 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
      const y = 64 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      stamp((fill, dy) => {
        ctx.fillStyle = fill;
        ctx.fillText(label, x, y + dy);
      });
    }
    return texture(canvas);
  });
}
