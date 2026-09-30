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

type Segment = { marker: number; length: number; body: number };

/** Size and signature checks before looking inside the file. */
function checkEnvelope(bytes: Uint8Array): JpegCheck | null {
  if (bytes.length === 0) return fail("empty");
  if (bytes.length > MAX_UPLOAD_BYTES) return fail("too-large");
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return fail("not-jpeg");
  return null;
}

/** Markers without a length field (TEM and RSTn/SOI). */
function isStandalone(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8);
}

/**
 * Reads the segment header at position i: skips fill bytes, returns the marker, its length and
 * where its body starts, or "corrupt"/"standalone" (a marker with no length, continue after it).
 */
function readSegment(bytes: Uint8Array, i: number): Segment | { standalone: number } | "corrupt" {
  if (bytes[i] !== 0xff) return "corrupt";
  while (bytes[i] === 0xff && i < bytes.length) i++;
  const marker = bytes[i];
  i++;
  if (marker === undefined || marker === 0xd9) return "corrupt"; // EOI before any image data
  if (isStandalone(marker)) return { standalone: i };
  if (i + 1 >= bytes.length) return "corrupt";
  const length = (bytes[i]! << 8) | bytes[i + 1]!;
  if (length < 2 || i + length > bytes.length) return "corrupt";
  return { marker, length, body: i };
}

/** Width and height from a start-of-frame segment. */
function frameSize(bytes: Uint8Array, seg: Segment): { width: number; height: number } | null {
  if (seg.length < 7) return null;
  const i = seg.body;
  return { height: (bytes[i + 3]! << 8) | bytes[i + 4]!, width: (bytes[i + 5]! << 8) | bytes[i + 6]! };
}

/** Start of scan: the headers are done, so the picture must have a known, allowed size. */
function finish(width: number, height: number): JpegCheck {
  if (!width || !height) return fail("corrupt");
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) return fail("too-big-dimensions");
  return { ok: true, width, height };
}

export function checkJpeg(bytes: Uint8Array): JpegCheck {
  const envelope = checkEnvelope(bytes);
  if (envelope) return envelope;
  let width = 0;
  let height = 0;
  let i = 2;
  while (i < bytes.length) {
    const seg = readSegment(bytes, i);
    if (seg === "corrupt") return fail("corrupt");
    if ("standalone" in seg) {
      i = seg.standalone;
      continue;
    }
    if (seg.marker === 0xe1) return fail("has-exif"); // APP1: EXIF (and GPS) or XMP
    if (SOF.has(seg.marker)) {
      const size = frameSize(bytes, seg);
      if (!size) return fail("corrupt");
      ({ width, height } = size);
    }
    if (seg.marker === 0xda) return finish(width, height);
    i = seg.body + seg.length;
  }
  return fail("corrupt");
}
