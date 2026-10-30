import { deflateSync, inflateSync } from "node:zlib";

/**
 * Minimal PNG writing, header reading and decoding: enough for board guide images, model output
 * sizes and reading back what a painted board shows.
 */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Encodes 8-bit RGBA pixels (row-major) as a PNG. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // no filter
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  ]);
}

/** Width and height from a PNG's header, or undefined for other formats. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return undefined;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

/** Decodes an 8-bit RGB or RGBA PNG (not interlaced) to RGBA pixels, row-major. */
export function decodePng(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = pngSize(b);
  if (!size) throw new Error("expected a PNG");
  const [depth, type, interlace] = [b[24], b[25], b[28]];
  if (depth !== 8 || (type !== 2 && type !== 6) || interlace !== 0) throw new Error(`unsupported PNG: depth ${depth}, color type ${type}, interlace ${interlace}`);
  const idat: Buffer[] = [];
  for (let at = 8; at + 8 <= b.length; ) {
    const length = b.readUInt32BE(at);
    const kind = b.toString("ascii", at + 4, at + 8);
    if (kind === "IDAT") idat.push(b.subarray(at + 8, at + 8 + length));
    if (kind === "IEND") break;
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const { width, height } = size;
  const channels = type === 6 ? 4 : 3;
  const stride = width * channels;
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? rows[out + x - channels] : 0;
      const up = y > 0 ? rows[out - stride + x] : 0;
      const corner = y > 0 && x >= channels ? rows[out - stride + x - channels] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - corner;
        const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - corner)];
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : corner;
      }
      rows[out + x] = (line[x] + predicted) & 0xff;
    }
  }
  if (channels === 4) return { width, height, rgba: rows };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < rows.length; i += 3, j += 4) [rgba[j], rgba[j + 1], rgba[j + 2], rgba[j + 3]] = [rows[i], rows[i + 1], rows[i + 2], 255];
  return { width, height, rgba };
}
