import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { relabelSources, type Picture } from "./content";
import { decodePng, encodePng } from "./png";

/** A 10 × 10 board painted as a 100 × 100 picture: one solid square per tile, centered on it. */
function paint(tiles: [number, number, [number, number, number]][]): Picture {
  const rgba = new Uint8Array(100 * 100 * 4).fill(240);
  for (const [x, y, [r, g, b]] of tiles)
    for (let j = y * 10 - 8; j < y * 10 + 8; j++)
      for (let i = x * 10 - 8; i < x * 10 + 8; i++) rgba.set([r, g, b, 255], (j * 100 + i) * 4);
  return { width: 100, height: 100, rgba };
}

const GREEN: [number, number, number] = [70, 130, 60];
const YELLOW: [number, number, number] = [225, 190, 80];
const BLUE: [number, number, number] = [80, 140, 210];
const BROWN: [number, number, number] = [130, 90, 60];

describe("checking what each painted tile shows", () => {
  it("moves a tile painted as another terrain to the kind it shows", () => {
    const picture = paint([
      [2, 2, GREEN],
      [4, 2, GREEN],
      [6, 2, GREEN],
      [8, 2, YELLOW], // asked for forest, painted as a field
      [2, 5, YELLOW],
      [4, 5, YELLOW],
      [6, 5, YELLOW],
      [2, 8, BLUE],
      [4, 8, BLUE],
      [8, 8, BROWN],
    ]);
    const { sources, moved } = relabelSources(picture, 10, 10, {
      forest: [[2, 2], [4, 2], [6, 2], [8, 2]],
      fields: [[2, 5], [4, 5], [6, 5]],
      reef: [[2, 8], [4, 8]],
      market: [[8, 8]],
    });
    expect(moved).toEqual([{ at: [8, 2], from: "forest", to: "fields" }]);
    expect(sources.forest).toHaveLength(3);
    expect(sources.fields).toContainEqual([8, 2]);
    // A kind with one tile that looks like nothing else keeps it.
    expect(sources.market).toEqual([[8, 8]]);
  });

  it("leaves a kind with nothing when its only tile looks just like another kind", () => {
    const picture = paint([
      [2, 2, YELLOW],
      [4, 2, YELLOW],
      [6, 2, YELLOW],
      [2, 5, GREEN],
      [4, 5, GREEN],
    ]);
    const { sources, moved } = relabelSources(picture, 10, 10, { hollow: [[6, 2]], meadow: [[2, 2], [4, 2]], forest: [[2, 5], [4, 5]] });
    expect(moved).toEqual([{ at: [6, 2], from: "hollow", to: "meadow" }]);
    expect(sources.hollow).toEqual([]);
  });

  it("keeps everything when every tile shows its terrain", () => {
    const picture = paint([
      [2, 2, GREEN],
      [4, 2, GREEN],
      [2, 5, YELLOW],
      [4, 5, YELLOW],
    ]);
    const sources = { forest: [[2, 2], [4, 2]] as [number, number][], fields: [[2, 5], [4, 5]] as [number, number][] };
    expect(relabelSources(picture, 10, 10, sources)).toEqual({ sources, moved: [] });
  });
});

/** An RGB PNG whose rows use filters 0 to 4 in turn, as image models' encoders do. CRCs are left at 0. */
function filteredPng(width: number, height: number, rgb: Uint8Array): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const filter = y % 5;
    raw[y * (stride + 1)] = filter;
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x;
      const left = x >= 3 ? rgb[at - 3] : 0;
      const up = y > 0 ? rgb[at - stride] : 0;
      const corner = y > 0 && x >= 3 ? rgb[at - stride - 3] : 0;
      const p = left + up - corner;
      const paeth = Math.abs(p - left) <= Math.abs(p - up) && Math.abs(p - left) <= Math.abs(p - corner) ? left : Math.abs(p - up) <= Math.abs(p - corner) ? up : corner;
      const predicted = [0, left, up, (left + up) >> 1, paeth][filter];
      raw[y * (stride + 1) + 1 + x] = (rgb[at] - predicted) & 0xff;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "ascii");
    data.copy(out, 8);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  [header[8], header[9]] = [8, 2];
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

describe("decoding a PNG", () => {
  it("reads back what encodePng wrote", () => {
    const rgba = Uint8Array.from({ length: 6 * 4 * 4 }, (_, i) => (i * 37) % 256);
    expect(decodePng(encodePng(6, 4, rgba))).toEqual({ width: 6, height: 4, rgba });
  });

  it("undoes every row filter of an RGB image", () => {
    const [width, height] = [7, 10];
    const rgb = Uint8Array.from({ length: width * height * 3 }, (_, i) => (i * 53 + (i >> 4) * 11) % 256);
    const { rgba } = decodePng(filteredPng(width, height, rgb));
    for (let i = 0; i < width * height; i++) expect([...rgba.subarray(i * 4, i * 4 + 4)]).toEqual([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], 255]);
  });
});
