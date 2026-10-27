import type { LucideIcon } from "lucide-react";

/** 2D canvas helpers for the textures printed on cards, mats and boards. */

export const FONT_DISPLAY = '"Fraunces Variable", Georgia, serif';
export const FONT_UI = '"Inter Variable", system-ui, sans-serif';

export const INK = "#2a241c";
export const PAPER = "#f6efe0";
export const CREAM = "#f4ece0";

export function canvas2d(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  return [canvas, canvas.getContext("2d")!];
}

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Small seeded generator so a card's painted wash is the same every time it is drawn. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Blends two #rrggbb colors; t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, "0")}`;
}

export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

type IconNode = [string, Record<string, string | number>][];

/** The SVG elements behind a lucide icon (lucide-react keeps them on the element it renders). */
function iconNode(icon: LucideIcon): IconNode {
  const forward = icon as unknown as { render(props: object, ref: null): { props: { icon: { node: IconNode } } } };
  return forward.render({}, null).props.icon.node;
}

const iconPaths = new Map<LucideIcon, Path2D[]>();

function pathsFor(icon: LucideIcon): Path2D[] {
  let paths = iconPaths.get(icon);
  if (paths) return paths;
  paths = iconNode(icon).map(([tag, a]) => {
    const n = (key: string) => Number(a[key] ?? 0);
    const path = new Path2D();
    switch (tag) {
      case "path":
        path.addPath(new Path2D(String(a.d)));
        break;
      case "circle":
        path.arc(n("cx"), n("cy"), n("r"), 0, Math.PI * 2);
        break;
      case "ellipse":
        path.ellipse(n("cx"), n("cy"), n("rx"), n("ry"), 0, 0, Math.PI * 2);
        break;
      case "rect":
        path.roundRect(n("x"), n("y"), n("width"), n("height"), n("rx"));
        break;
      case "line":
        path.moveTo(n("x1"), n("y1"));
        path.lineTo(n("x2"), n("y2"));
        break;
      case "polyline":
      case "polygon": {
        const points = String(a.points).trim().split(/[\s,]+/).map(Number);
        for (let i = 0; i + 1 < points.length; i += 2) (i === 0 ? path.moveTo : path.lineTo).call(path, points[i], points[i + 1]);
        if (tag === "polygon") path.closePath();
        break;
      }
    }
    return path;
  });
  iconPaths.set(icon, paths);
  return paths;
}

/** Strokes a lucide icon centered at (cx, cy), `size` pixels across. */
export function drawIcon(ctx: CanvasRenderingContext2D, icon: LucideIcon, cx: number, cy: number, size: number, color: string, stroke = 2) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = stroke;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const path of pathsFor(icon)) ctx.stroke(path);
  ctx.restore();
}

/** Largest font size (down to `min`) at which `text` fits in `maxWidth`. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, max: number, min: number, font: (size: number) => string): number {
  for (let size = max; size > min; size -= 1) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  ctx.font = font(min);
  return min;
}

export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

let grain: HTMLCanvasElement | undefined;

/** Tileable speckle used as paper and cardboard grain. */
export function grainPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  if (!grain) {
    const [canvas, g] = canvas2d(256, 256);
    const image = g.createImageData(256, 256);
    const rand = seeded(7);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = rand() < 0.5 ? 0 : 255;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = Math.floor(rand() * 34);
    }
    g.putImageData(image, 0, 0);
    grain = canvas;
  }
  return ctx.createPattern(grain, "repeat")!;
}

/** Draws only a blurred shadow of a rounded rect: a soft glow that stays inside the canvas. */
export function softRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string, blur: number) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 10000;
  roundRect(ctx, x - 10000, y, w, h, r);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();
}

/** Six-pointed sparkle / brand hexagon outline. */
export function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Value noise in [0, 1], smooth and tileable every `px` cells across and `py` cells down. */
export function noise2(seed: number, px: number, py: number) {
  const rand = seeded(seed);
  const grid = Float32Array.from({ length: px * py }, rand);
  const at = (x: number, y: number) => grid[(((y % py) + py) % py) * px + (((x % px) + px) % px)];
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}
