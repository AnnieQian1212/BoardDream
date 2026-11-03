import { regularPolygon, type Geometry, type GeometryCell } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import type { ModelClient } from "../meta/client";
import { framed, guideColors, INSIDE_TILES, intoBoard, legend, outlineIoUs, paintBoard, paintFrame, rowsOf } from "./board";
import { decodePng, encodePng } from "./png";

const tile = (id: string, kind: string, terrain?: GeometryCell["terrain"], x = 0): GeometryCell => ({
  id,
  kind,
  terrain,
  polygon: [
    [x, 0],
    [x + 1, 0],
    [x + 1, 1],
    [x, 1],
  ],
});

describe("the board painter's guide", () => {
  // Farlight Reefs: three kinds of water, villages on grass, headlands on stone.
  const coast: Geometry = {
    width: 12,
    height: 1,
    cells: [
      tile("a", "headland", "stone", 0),
      tile("b", "village", "grass", 1),
      tile("c", "cove", "water", 2),
      tile("d", "cove", "water", 3),
      tile("e", "wreck", "water", 4),
      tile("f", "reef", "water", 5),
      tile("g", "reef", "water", 6),
      tile("h", "reef", "water", 7),
    ],
    pieces: [],
  };

  it("colors every kind of water a blue, and no two kinds alike", () => {
    const colors = guideColors(coast);
    for (const kind of ["cove", "wreck", "reef"]) {
      const [r, , b] = colors.get(kind)!.rgb;
      expect(b, kind).toBeGreaterThan(r);
      expect(colors.get(kind)!.ground).toBe("water");
    }
    const names = [...colors.values()].map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("tells the painter what ground each kind is", () => {
    const text = legend(coast);
    expect(text).toContain("tiles are cove (water)");
    expect(text).toContain("tiles are village (grassland)");
    expect(text).toContain("tiles are headland (rocky ground)");
    // The commonest water is plain blue.
    expect(text).toContain("blue tiles are reef (water)");
  });

  it("takes a kind named for water as water when its cells give no ground", () => {
    const bay: Geometry = { width: 2, height: 1, cells: [tile("a", "sea", undefined, 0), tile("b", "market", undefined, 1)], pieces: [] };
    expect(guideColors(bay).get("sea")!.ground).toBe("water");
    expect(guideColors(bay).get("market")!.ground).toBeUndefined();
  });

  it("tells the painter how a grid of like tiles is laid out", () => {
    // Farlight Reefs' coast: hexes in rows of 3, 5, 6, 4 and 3.
    const w = Math.sqrt(3);
    const cells = [3, 5, 6, 4, 3].flatMap((count, row) =>
      Array.from({ length: count }, (_, i) => ({ id: `${row}-${i}`, kind: "reef", polygon: regularPolygon(2 + i * w + (row % 2) * (w / 2), 2 + row * 1.5, 1, 6) })),
    );
    expect(rowsOf({ width: 14, height: 10, cells, pieces: [] })).toBe("21 tiles in 5 rows of 3, 5, 6, 4 and 3 from the top");
    // Spaces of mixed sizes are not described.
    const mixed = [tile("a", "field", undefined, 0), tile("b", "field", undefined, 1), tile("c", "field", undefined, 2), { ...tile("d", "order", undefined, 3), polygon: regularPolygon(5, 2, 2, 4) }];
    expect(rowsOf({ width: 8, height: 4, cells: mixed, pieces: [] })).toBeUndefined();
  });
});

describe("the part of the board the painter is given", () => {
  const box = (id: string, x: number, y: number, w: number, h: number): GeometryCell => ({
    id,
    kind: "lantern",
    polygon: [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
  });
  // Fogfall Lanterns: two rows of spaces across the top two thirds, the table's text below.
  const fogfall: Geometry = {
    width: 17.2,
    height: 8.6,
    cells: [
      ...Array.from({ length: 7 }, (_, i) => box(`l${i}`, 0.56 + i * 2.4, 1.6, 1.7, 1.9)),
      ...Array.from({ length: 6 }, (_, i) => box(`s${i}`, 0.56 + i * 2.4, 4.4, 1.7, 1.4)),
      { id: "night", kind: "label", label: "Night 1 of 5", polygon: [[2, 6.5], [15, 6.5], [15, 8], [2, 8]] },
    ],
    pieces: [{ id: "p", x: 1.4, y: 2.5, r: 0.3 }],
  };

  it("is the whole board when the tiles fill it", () => {
    const grid: Geometry = { width: 4, height: 2, cells: Array.from({ length: 8 }, (_, i) => box(`c${i}`, (i % 4) + 0.05, Math.floor(i / 4) + 0.05, 0.9, 0.9)), pieces: [] };
    expect(paintFrame(grid)).toEqual({ x: 0, y: 0, width: 4, height: 2 });
  });

  it("is the tiles with a margin when they leave much of the board bare, never longer than 3:1", () => {
    const frame = paintFrame(fogfall);
    // Not the text below the tiles.
    expect(frame.y + frame.height).toBeLessThan(7.2);
    for (const cell of fogfall.cells.filter((c) => c.kind !== "label")) {
      for (const [x, y] of cell.polygon) {
        expect(x).toBeGreaterThan(frame.x);
        expect(x).toBeLessThan(frame.x + frame.width);
        expect(y).toBeGreaterThan(frame.y);
        expect(y).toBeLessThan(frame.y + frame.height);
      }
    }
    expect(frame.width / frame.height).toBeLessThanOrEqual(3 + 1e-9);
    const inFrame = framed(fogfall, frame);
    expect(inFrame.width).toBe(frame.width);
    expect(inFrame.cells[0].polygon[0]).toEqual([0.56 - frame.x, 1.6 - frame.y]);
    expect(inFrame.pieces[0]).toMatchObject({ x: 1.4 - frame.x, y: 2.5 - frame.y });
  });

  it("is set back into a picture of the whole board at its scale, on its paper", () => {
    // A 4 x 2 painting of the frame (2, 1)-(4, 2) of an 8 x 4 board, 2 pixels per unit: red on cream paper.
    const rgba = new Uint8Array(4 * 2 * 4);
    for (let i = 0; i < 8; i++) rgba.set(i === 5 ? [200, 30, 30, 255] : [236, 224, 197, 255], i * 4);
    const board = decodePng(intoBoard(encodePng(4, 2, rgba), { x: 2, y: 1, width: 2, height: 1 }, { width: 8, height: 4 }));
    expect([board.width, board.height]).toEqual([16, 8]);
    // The painting's pixel (1, 1) lands at (4 + 1, 2 + 1); everything off the frame is its paper.
    expect([...board.rgba.subarray((3 * 16 + 5) * 4, (3 * 16 + 5) * 4 + 3)]).toEqual([200, 30, 30]);
    // (the paper's color as read off the painting, to within its sampling)
    [236, 224, 197].forEach((c, i) => expect(Math.abs(board.rgba[i] - c)).toBeLessThan(6));
    // A whole-board frame is the painting as it was.
    const whole = encodePng(4, 2, rgba);
    expect(intoBoard(whole, { x: 0, y: 0, width: 8, height: 4 }, { width: 8, height: 4 })).toBe(whole);
  });
});

describe("reading a painted space off the painter's gaps", () => {
  // Cream cards on dark gaps, each with a small dark lantern in the middle (which SAM, given the
  // card's box, segments instead of the card).
  function painting(cards: [number, number][], size = 40) {
    const [width, height] = [200, 80];
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) rgba.set([50, 41, 33, 255], i * 4);
    for (const [left, top] of cards) {
      for (let y = top; y < top + size; y++) for (let x = left; x < left + size; x++) rgba.set([238, 228, 205, 255], (y * width + x) * 4);
      for (let y = top + 15; y < top + 25; y++) for (let x = left + 15; x < left + 25; x++) rgba.set([60, 50, 40, 255], (y * width + x) * 4);
    }
    return { width, height, rgba };
  }
  const square = (left: number, top: number, size = 40): [number, number][] => [
    [left, top],
    [left + size, top],
    [left + size, top + size],
    [left, top + size],
  ];
  const where: [number, number][] = [
    [10, 20],
    [80, 20],
    [150, 20],
  ];

  it("finds a card where the guide put it, lantern and all", () => {
    for (const iou of outlineIoUs(painting(where), where.map(([x, y]) => square(x, y)))) expect(iou).toBeGreaterThan(0.95);
  });

  it("scores a card the painter moved or stretched low", () => {
    const moved = outlineIoUs(painting(where.map(([x, y]) => [x + 14, y + 12])), where.map(([x, y]) => square(x, y)));
    for (const iou of moved) expect(iou).toBeLessThan(0.6);
  });
});

describe("stopping a board being painted", () => {
  it("cuts off the model call under way and saves nothing", async () => {
    const id = "zz-test-stopped-board";
    const dir = new URL(`../../../../data/art/${id}/`, import.meta.url);
    // A painter that never answers on its own: it only ends when it is stopped.
    let calls = 0;
    let prompt = "";
    const painter = {
      post: (_path: string, body: { prompt: string }, _attempts: number, signal?: AbortSignal) =>
        new Promise((_, reject) => {
          calls++;
          prompt = body.prompt;
          signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    } as unknown as ModelClient;
    const stop = new AbortController();
    const steps: string[] = [];
    const cells = Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, kind: "field", polygon: [[i, 0], [i + 0.9, 0], [i + 0.9, 0.9], [i, 0.9]] as [number, number][] }));
    try {
      const painting = paintBoard(painter, { image: "image", sam: "sam" }, id, { game: "Test", summary: "a test", geometry: { width: 4, height: 1, cells, pieces: [] } }, (step) => {
        steps.push(step);
        // Stopped while the painter is at work.
        setTimeout(() => stop.abort(), 5);
      }, stop.signal);
      await expect(painting).rejects.toThrow();
      expect(steps).toEqual(["painting the board"]);
      expect(calls).toBe(1);
      // The painter is told to keep what stands on a tile inside it: the table crops each tile a little.
      expect(prompt).toContain(INSIDE_TILES);
      expect(existsSync(new URL("board.json", dir))).toBe(false);
      expect(existsSync(new URL("board.png", dir))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
