import { regularPolygon, type Geometry } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import { renderGuide } from "./board";
import { decodePng } from "./png";
import { applyRegistration, register } from "./register";
import type { Picture } from "./content";

/** A small hex board: three rows of touching hexes, as Farlight Reefs lays its coast. */
function hexBoard(): Geometry {
  const r = 1;
  const w = Math.sqrt(3) * r;
  const cells = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const cx = 1.2 + col * w + (row % 2) * (w / 2);
      const cy = 1.2 + row * 1.5 * r;
      cells.push({ id: `t${row}-${col}`, kind: col % 2 ? "reef" : "cove", polygon: regularPolygon(cx, cy, r, 6).map(([x, y]) => [x, y] as [number, number]) });
    }
  }
  return { width: 1.2 * 2 + 3.5 * w, height: 2.4 + 3 * r + 0.2, cells, pieces: [] };
}

/** The picture moved `dy` pixels down, the top filled with its first row. */
function shiftedDown(picture: Picture, dy: number): Picture {
  const rgba = new Uint8Array(picture.rgba.length);
  const row = picture.width * 4;
  for (let y = 0; y < picture.height; y++) rgba.set(picture.rgba.subarray(Math.max(0, y - dy) * row, (Math.max(0, y - dy) + 1) * row), y * row);
  return { ...picture, rgba };
}

describe("lining a painting up with its board", () => {
  const geometry = hexBoard();
  const guide = decodePng(renderGuide(geometry).png);
  const px = guide.width / geometry.width;

  // Farlight Reefs' tiles came back about a fifth of a tile low: here 30 pixels, a sixth of a tile.
  const low = shiftedDown(guide, 30);
  /** The color just inside each tile's top corner, where a low painting shows the gap above the tile. */
  const tops = (p: Picture) =>
    geometry.cells.map((cell) => {
      const [cx, cy] = [cell.polygon.reduce((s, [x]) => s + x, 0) / 6, cell.polygon.reduce((s, [, y]) => s + y, 0) / 6];
      const [, ty] = cell.polygon.reduce((a, b) => (b[1] < a[1] ? b : a));
      const [x, y] = [Math.round(cx * px), Math.round((cy + (ty - cy) * 0.8) * px)];
      return [...p.rgba.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 3)].join(",");
    });

  it("finds that the painted tiles came out low", () => {
    const { registration } = register(low, geometry, geometry.cells);
    expect(registration.shiftY * px).toBeGreaterThan(15);
    expect(registration.after).toBeGreaterThan(registration.before + 0.05);
  });

  it("moves the tiles back where the guide put them", () => {
    const { picture } = register(low, geometry, geometry.cells);
    // Low, every tile's top shows the border above it; lined up, its own color again.
    expect(tops(low).filter((c, i) => c === tops(guide)[i]).length).toBe(0);
    expect(tops(picture)).toEqual(tops(guide));
  });

  it("leaves a painting that already lines up as it is", () => {
    const { picture, registration } = register(guide, geometry, geometry.cells);
    expect(picture).toBe(guide);
    expect([registration.scaleX, registration.scaleY, registration.shiftX, registration.shiftY]).toEqual([1, 1, 0, 0]);
  });

  it("resamples without moving anything at no stretch and no shift", () => {
    const same = applyRegistration(guide, geometry, { scaleX: 1, scaleY: 1, shiftX: 0, shiftY: 0, before: 0, after: 0 });
    expect(Buffer.from(same.rgba).equals(Buffer.from(guide.rgba))).toBe(true);
  });
});
