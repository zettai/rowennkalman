import { readFileSync } from "node:fs";
import path from "node:path";

const seg = (marker: number, payload: number[]) => [0xff, marker, ((payload.length + 2) >> 8) & 0xff, (payload.length + 2) & 0xff, ...payload];

/** A structurally valid JPEG header with the given size (enough for the checker). */
export function tinyJpeg(width = 640, height = 480, extra: number[][] = []): Uint8Array {
  const jfif = seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const dqt = seg(0xdb, [0, ...new Array(64).fill(1)]);
  const sof = seg(0xc0, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]);
  const sos = seg(0xda, [1, 1, 0, 0, 0x3f, 0]);
  return new Uint8Array([0xff, 0xd8, ...extra.flat(), ...jfif, ...dqt, ...sof, ...sos, 0x12, 0x34, 0xff, 0xd9]);
}

export const exifSegment = seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a]);

/** A real JPEG produced by scripts/make-placeholders.mjs. */
export function seedJpeg(name = "seed-art-1.jpg"): Uint8Array {
  return new Uint8Array(readFileSync(path.join(__dirname, "..", "..", "content", "seed-images", name)));
}

/** The same real JPEG with an EXIF (APP1) segment spliced in after SOI, as a phone camera would write. */
export function seedJpegWithExif(): Uint8Array {
  const src = seedJpeg();
  return new Uint8Array([...src.slice(0, 2), ...exifSegment, ...src.slice(2)]);
}
