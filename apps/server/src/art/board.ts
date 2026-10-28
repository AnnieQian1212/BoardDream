import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Geometry, GeometryCell } from "@boarddream/engine";
import { parseImageStream, recordsOfKind, decodeMaskToRaster, type ResponsesEvent } from "@meta-sam/parser";
import type { ModelClient } from "../meta/client";
import { boxPrompt, segment, type PixelBox } from "../meta/media";
import { HOUSE_STYLE } from "./cards";
import { encodePng, pngSize } from "./png";

/**
 * Board art with an alignment check. The engine's geometry is rendered as a flat guide image,
 * Muse Image repaints it as an illustrated board, and SAM 3.1 segments every tile from a box
 * prompt. Each tile's mask is compared with where the tile should be (IoU); misaligned tiles get
 * one targeted repaint, and the better-aligned painting is kept.
 */

const ROOT = new URL("../../../../data/art/", import.meta.url);
const GUIDE_WIDTH = 1536;
const THRESHOLD = 0.8;
const SAM_OBJECTS = 16;

/** Tiles worth painting and checking: not text, not the small building spots and roads. */
const isTile = (cell: GeometryCell) => cell.kind !== "label" && cell.kind !== "vertex" && cell.kind !== "edge";

const GUIDE_COLORS: Record<string, [number, number, number]> = {
  forest: [70, 140, 70],
  quarry: [150, 150, 145],
  fields: [225, 195, 85],
  reef: [90, 160, 215],
  lagoon: [130, 210, 200],
  ladder: [150, 205, 130],
  snake: [235, 150, 130],
};
const PALETTE: [number, number, number][] = [
  [200, 120, 90],
  [110, 160, 200],
  [170, 140, 210],
  [220, 180, 90],
  [120, 180, 110],
  [205, 130, 160],
  [100, 190, 175],
  [185, 160, 120],
];
const BORDER: [number, number, number] = [52, 42, 34];

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

const colorOf = (kind: string | undefined): [number, number, number] =>
  kind ? (GUIDE_COLORS[kind] ?? PALETTE[hash(kind) % PALETTE.length]) : [236, 224, 197];

const NAMED: [string, [number, number, number]][] = [
  ["green", [70, 140, 70]],
  ["gray", [150, 150, 145]],
  ["yellow", [225, 195, 85]],
  ["blue", [90, 160, 215]],
  ["teal", [130, 210, 200]],
  ["red", [200, 90, 80]],
  ["orange", [220, 150, 80]],
  ["purple", [170, 140, 210]],
  ["pink", [205, 130, 160]],
  ["brown", [150, 110, 80]],
  ["cream", [236, 224, 197]],
];

const colorName = (rgb: [number, number, number]) =>
  NAMED.map(([name, c]) => [name, (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2] as const).sort((a, b) => a[1] - b[1])[0][0];

interface Scaled {
  width: number;
  height: number;
  scale: number;
}

const centroid = (polygon: [number, number][]): [number, number] => [
  polygon.reduce((s, [x]) => s + x, 0) / polygon.length,
  polygon.reduce((s, [, y]) => s + y, 0) / polygon.length,
];

/** Even-odd point-in-polygon test. */
function inside(polygon: [number, number][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The flat guide: each tile filled with its kind's color, separated by dark borders. */
export function renderGuide(geometry: Geometry): { png: Buffer; size: Scaled } {
  const scale = GUIDE_WIDTH / geometry.width;
  const width = GUIDE_WIDTH;
  const height = Math.round(geometry.height * scale);
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) rgba.set([...BORDER, 255], i * 4);
  for (const cell of geometry.cells.filter(isTile)) {
    const [cx, cy] = centroid(cell.polygon);
    // Shrunk toward the center so a border shows between neighbors.
    const poly = cell.polygon.map(([x, y]) => [(cx + (x - cx) * 0.93) * scale, (cy + (y - cy) * 0.93) * scale] as [number, number]);
    const color = colorOf(cell.kind);
    const xs = poly.map(([x]) => x);
    const ys = poly.map(([, y]) => y);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(height, Math.ceil(Math.max(...ys))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < Math.min(width, Math.ceil(Math.max(...xs))); x++) {
        if (inside(poly, x + 0.5, y + 0.5)) rgba.set([...color, 255], (y * width + x) * 4);
      }
    }
  }
  return { png: encodePng(width, height, rgba), size: { width, height, scale } };
}

/** "green tiles are forest, gray tiles are quarry, ...": how the guide's colors read. */
function legend(geometry: Geometry): string {
  const kinds = [...new Set(geometry.cells.filter(isTile).map((c) => c.kind ?? "plain"))];
  return kinds.map((kind) => `${colorName(colorOf(kind === "plain" ? undefined : kind))} tiles are ${kind === "plain" ? "plain spaces" : kind}`).join(", ");
}

interface ImageReply {
  data?: { b64_json?: string }[];
}

async function edit(client: ModelClient, model: string, prompt: string, images: Buffer[], size: Scaled): Promise<Buffer> {
  const reply = (await client.post("/images/edits", {
    model,
    prompt,
    images: images.map((png) => ({ image_url: `data:image/png;base64,${png.toString("base64")}` })),
    n: 1,
    size: `${size.width}x${size.height}`,
    output_format: "png",
  })) as ImageReply;
  const b64 = reply.data?.[0]?.b64_json;
  if (!b64) throw new Error("Muse Image returned no image");
  return Buffer.from(b64, "base64");
}

export interface TileScore {
  id: string;
  iou: number;
}

export interface BoardReport {
  /** Size of the geometry the painting covers, in board units. */
  width: number;
  height: number;
  /**
   * For each tile kind, centers (board units) of well-aligned painted tiles of that kind. The table
   * paints any tile of a kind from one of these, so the art survives a reshuffled map.
   */
  sources: Record<string, [number, number][]>;
  meanIoU: number;
  alignedShare: number;
  tiles: number;
  misaligned: TileScore[];
  /** Mean IoU of the first painting, before any targeted repaint. */
  firstMeanIoU: number;
  repainted: boolean;
}

/** Feeds a finished SAM output text to the parser as if it had streamed. */
async function parseSam(text: string) {
  async function* events(): AsyncIterable<ResponsesEvent> {
    yield { type: "response.output_text.delta", item_id: "m", output_index: 0, content_index: 0, delta: text } as ResponsesEvent;
    yield { type: "response.output_text.done", item_id: "m", output_index: 0, content_index: 0, text } as ResponsesEvent;
    yield { type: "response.completed" } as ResponsesEvent;
  }
  return (await parseImageStream(events()).finalResult).records;
}

/** IoU of a tile's polygon (image pixels) with a SAM mask placed at its box, computed over their joint bounds. */
function tileIoU(polygon: [number, number][], mask: { raster: Uint8Array; left: number; top: number; width: number; height: number } | undefined): number {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  let [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  if (mask) [x0, y0, x1, y1] = [Math.min(x0, mask.left), Math.min(y0, mask.top), Math.max(x1, mask.left + mask.width), Math.max(y1, mask.top + mask.height)];
  let intersection = 0;
  let union = 0;
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      const expected = inside(polygon, x + 0.5, y + 0.5);
      const mx = x - (mask?.left ?? 0);
      const my = y - (mask?.top ?? 0);
      const found = mask !== undefined && mx >= 0 && my >= 0 && mx < mask.width && my < mask.height && mask.raster[my * mask.width + mx] === 1;
      if (expected && found) intersection++;
      if (expected || found) union++;
    }
  }
  return union === 0 ? 0 : intersection / union;
}

/** Segments every tile of a painted board with SAM 3.1 and scores it against the geometry. */
export async function checkAlignment(client: ModelClient, samModel: string, geometry: Geometry, painted: Buffer): Promise<TileScore[]> {
  const size = pngSize(painted);
  if (!size) throw new Error("expected a PNG");
  const sx = size.width / geometry.width;
  const sy = size.height / geometry.height;
  const tiles = geometry.cells.filter(isTile);
  const polygons = tiles.map((cell) => cell.polygon.map(([x, y]) => [x * sx, y * sy] as [number, number]));
  const boxes: PixelBox[] = polygons.map((p) => ({
    x1: Math.max(0, Math.min(...p.map(([x]) => x))),
    y1: Math.max(0, Math.min(...p.map(([, y]) => y))),
    x2: Math.min(size.width - 1, Math.max(...p.map(([x]) => x))),
    y2: Math.min(size.height - 1, Math.max(...p.map(([, y]) => y))),
  }));
  // SAM 3.1 takes at most 16 objects per request, so tiles go in batches.
  const image = `data:image/png;base64,${painted.toString("base64")}`;
  const batches = Array.from({ length: Math.ceil(boxes.length / SAM_OBJECTS) }, (_, b) => b * SAM_OBJECTS);
  const masks = new Map<number, { raster: Uint8Array; left: number; top: number; width: number; height: number }>();
  await Promise.all(
    batches.map(async (start) => {
      const text = await segment(client, samModel, image, boxPrompt(boxes.slice(start, start + SAM_OBJECTS), size.width, size.height));
      for (const record of recordsOfKind(await parseSam(text), "mask")) {
        // boxPrompt numbers objects from 1 within each batch.
        masks.set(start + Number(record.objectId) - 1, {
          raster: decodeMaskToRaster(record.mask),
          left: record.bounds.left,
          top: record.bounds.top,
          width: record.mask.width,
          height: record.mask.height,
        });
      }
    }),
  );
  return tiles.map((cell, i) => ({ id: cell.id, iou: tileIoU(polygons[i], masks.get(i)) }));
}

function summarize(scores: TileScore[]): Omit<BoardReport, "firstMeanIoU" | "repainted" | "width" | "height" | "sources"> {
  const aligned = scores.filter((s) => s.iou >= THRESHOLD);
  return {
    meanIoU: scores.reduce((sum, s) => sum + s.iou, 0) / Math.max(1, scores.length),
    alignedShare: aligned.length / Math.max(1, scores.length),
    tiles: scores.length,
    misaligned: scores.filter((s) => s.iou < THRESHOLD).sort((a, b) => a.iou - b.iou),
  };
}

/** Where a tile sits, in words an image model can follow. */
function whereIs(geometry: Geometry, id: string): string {
  const cell = geometry.cells.find((c) => c.id === id)!;
  const [cx, cy] = centroid(cell.polygon);
  return `${Math.round((100 * cx) / geometry.width)}% from the left and ${Math.round((100 * cy) / geometry.height)}% from the top`;
}

/** The saved report for a game's painted board, if there is one. */
export function boardReport(gameId: string): BoardReport | undefined {
  if (!/^[a-z0-9-]+$/.test(gameId)) return undefined;
  const file = new URL(`${gameId}/board.json`, ROOT);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as BoardReport) : undefined;
}

export interface BoardRequest {
  game: string;
  summary: string;
  geometry: Geometry;
}

/** Paints the board, checks it with SAM, repaints misaligned tiles once, and saves the best version. */
export async function paintBoard(
  client: ModelClient,
  models: { image: string; sam: string },
  gameId: string,
  req: BoardRequest,
  onStep: (step: string) => void,
): Promise<BoardReport> {
  if (!/^[a-z0-9-]+$/.test(gameId)) throw new Error(`bad game id: ${gameId}`);
  const dir = new URL(`${gameId}/`, ROOT);
  mkdirSync(dir, { recursive: true });
  const { png: guide, size } = renderGuide(req.geometry);
  writeFileSync(new URL("board-guide.png", dir), guide);

  onStep("painting the board");
  const prompt = `Repaint this game board guide as an illustrated board for "${req.game}", a board game where ${req.summary.replace(/\.$/, "")}. In the guide, ${legend(req.geometry)}; paint each tile as that terrain or space. Keep every tile exactly where it is with the same shape and outline, and keep the dark gaps between tiles as borders. ${HOUSE_STYLE}.`;
  let painted = await edit(client, models.image, prompt, [guide], size);
  writeFileSync(new URL("board-first.png", dir), painted);

  onStep("checking every tile with SAM 3.1");
  let scores = await checkAlignment(client, models.sam, req.geometry, painted);
  const first = summarize(scores);
  let repainted = false;

  if (first.misaligned.length > 0) {
    onStep(`repainting ${first.misaligned.length} misaligned tile${first.misaligned.length === 1 ? "" : "s"}`);
    const spots = first.misaligned
      .slice(0, 8)
      .map((s) => whereIs(req.geometry, s.id))
      .join("; ");
    const fixPrompt = `The first image is a painted game board; the second is its layout guide. Some painted tiles drifted from the guide's outlines, around: ${spots}. Repaint those tiles so their shapes and borders match the guide exactly, and keep everything else unchanged. ${HOUSE_STYLE}.`;
    const fixed = await edit(client, models.image, fixPrompt, [painted, guide], size);
    onStep("checking the repaint");
    const fixedScores = await checkAlignment(client, models.sam, req.geometry, fixed);
    if (summarize(fixedScores).meanIoU > first.meanIoU) {
      [painted, scores, repainted] = [fixed, fixedScores, true];
    }
  }

  // Well-aligned tiles become the painted sources for their kind (the best one if none passed).
  const tiles = req.geometry.cells.filter(isTile);
  const iouOf = new Map(scores.map((score) => [score.id, score.iou]));
  const sources: Record<string, [number, number][]> = {};
  for (const kind of new Set(tiles.map((c) => c.kind ?? "plain"))) {
    const ofKind = tiles.filter((c) => (c.kind ?? "plain") === kind);
    const aligned = ofKind.filter((c) => (iouOf.get(c.id) ?? 0) >= THRESHOLD);
    const chosen = aligned.length > 0 ? aligned : [ofKind.reduce((a, b) => ((iouOf.get(b.id) ?? 0) > (iouOf.get(a.id) ?? 0) ? b : a))];
    sources[kind] = chosen.map((c) => centroid(c.polygon));
  }
  const report: BoardReport = {
    width: req.geometry.width,
    height: req.geometry.height,
    sources,
    ...summarize(scores),
    firstMeanIoU: first.meanIoU,
    repainted,
  };
  writeFileSync(new URL("board.png", dir), painted);
  writeFileSync(new URL("board.json", dir), JSON.stringify(report, null, 2) + "\n");
  return report;
}
