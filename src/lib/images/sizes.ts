/**
 * Pre-made picture sizes (see docs/IMAGES.md). Every uploaded picture (a JPEG of at most
 * 2800 px, already shrunk and cleaned in the browser) gets WebP copies at these widths, stored
 * next to it: art/<id>.jpg -> art/<id>-640.webp, -960, -1280, -1920. Pages list them in a
 * srcset with the original as the largest option, and the browser picks one. Widths wider than
 * the picture itself are skipped (never enlarged).
 *
 * Phones (most visitors) use 640 (thumbnails), 960 (full width on 2x screens) and 1280 (full
 * width on 3x screens, the lightbox); 1920 and the original serve desktops.
 */
export const SIZE_WIDTHS = [640, 960, 1280, 1920] as const;
export const WEBP_QUALITY = 80;

export const SIZE_KEY_PATTERN = /^art\/[A-Za-z0-9][A-Za-z0-9._-]*-\d{2,4}\.webp$/;

/** art/<id>.jpg + 640 -> art/<id>-640.webp */
export function sizeKey(originalKey: string, width: number): string {
  if (!originalKey.endsWith(".jpg")) throw new Error(`Not an original picture key: ${originalKey}`);
  return `${originalKey.slice(0, -".jpg".length)}-${width}.webp`;
}

/** The widths worth making for a picture this wide. */
export function widthsFor(originalWidth: number): number[] {
  return SIZE_WIDTHS.filter((w) => w < originalWidth);
}

export type MadeSize = { width: number; bytes: Uint8Array };

/** Resizes a JPEG into WebP copies. sharp is loaded on demand so pages never bundle it. */
export async function makeSizes(jpeg: Uint8Array, originalWidth: number): Promise<MadeSize[]> {
  const { default: sharp } = await import("sharp");
  const out: MadeSize[] = [];
  for (const width of widthsFor(originalWidth)) {
    const bytes = await sharp(jpeg).resize({ width, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer();
    out.push({ width, bytes: new Uint8Array(bytes) });
  }
  return out;
}

/** The srcset for a picture that has sizes: the WebP copies, then the original at its own width. */
export function srcSetFor(base: string, image: { key: string; width: number; sizes?: number[] }): string | undefined {
  if (!image.sizes?.length) return undefined;
  const root = base.replace(/\/$/, "");
  return [...image.sizes.map((w) => `${root}/${sizeKey(image.key, w)} ${w}w`), `${root}/${image.key} ${image.width}w`].join(", ");
}
