/**
 * Server-side re-check of browser-processed uploads. The browser already
 * decoded, oriented, downscaled and re-encoded the image; this makes sure
 * what arrives really is such a JPEG and carries no EXIF/GPS.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_DIMENSION = 2800;

export type JpegCheck =
  | { ok: true; width: number; height: number }
  | { ok: false; reason: "empty" | "too-large" | "not-jpeg" | "has-exif" | "corrupt" | "too-big-dimensions"; message: string };

const MESSAGES = {
  empty: "The file was empty.",
  "too-large": "That picture is too large (over 5 MB) even after shrinking. Try a smaller one.",
  "not-jpeg": "That file is not a picture we can use. Please choose a JPEG, PNG or WebP photo.",
  "has-exif": "The picture still carries camera data. Please pick it again so it can be cleaned.",
  corrupt: "That picture seems damaged. Please try another one.",
  "too-big-dimensions": "That picture is larger than expected. Please pick it again.",
} as const;

const fail = (reason: keyof typeof MESSAGES): JpegCheck => ({ ok: false, reason, message: MESSAGES[reason] });

// Start-of-frame markers carry the dimensions (baseline, progressive, etc.; not DHT/JPG/DAC).
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export function checkJpeg(bytes: Uint8Array): JpegCheck {
  if (bytes.length === 0) return fail("empty");
  if (bytes.length > MAX_UPLOAD_BYTES) return fail("too-large");
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return fail("not-jpeg");

  let width = 0;
  let height = 0;
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return fail("corrupt");
    // Skip fill bytes.
    while (bytes[i] === 0xff && i < bytes.length) i++;
    const marker = bytes[i];
    i++;
    if (marker === undefined) return fail("corrupt");
    if (marker === 0xd9) return fail("corrupt"); // EOI before any image data
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue; // no length field
    if (i + 1 >= bytes.length) return fail("corrupt");
    const length = (bytes[i]! << 8) | bytes[i + 1]!;
    if (length < 2 || i + length > bytes.length) return fail("corrupt");
    if (marker === 0xe1) return fail("has-exif"); // APP1: EXIF (and GPS) or XMP
    if (SOF.has(marker)) {
      if (length < 7) return fail("corrupt");
      height = (bytes[i + 3]! << 8) | bytes[i + 4]!;
      width = (bytes[i + 5]! << 8) | bytes[i + 6]!;
    }
    if (marker === 0xda) {
      // Start of scan: headers are done.
      if (!width || !height) return fail("corrupt");
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) return fail("too-big-dimensions");
      return { ok: true, width, height };
    }
    i += length;
  }
  return fail("corrupt");
}
