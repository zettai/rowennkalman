const GUTTER = "clamp(1rem, 4vw, 3rem)";

/** Content width inside horizontal lightbox padding (--gutter on each side). */
export const LIGHTBOX_BOX_WIDTH = `calc(100vw - 2 * ${GUTTER})`;

/**
 * Upper bound on the 1fr image row: minimum vertical padding (one gutter top and bottom),
 * one grid gap, controls at min-height only. Omits the text row so sizes never undershoots.
 */
export const LIGHTBOX_IMAGE_ROW_HEIGHT = `calc(100vh - 2 * ${GUTTER} - 1rem - 44px)`;

/** `sizes` for a contain lightbox painting: never below the drawn width (may be one step high). */
export function lightboxSizesForPicture(width: number, height: number): string {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "90vw";
  }
  const w = Math.round(width);
  const h = Math.round(height);
  return `min(${LIGHTBOX_BOX_WIDTH}, calc(${LIGHTBOX_IMAGE_ROW_HEIGHT} * ${w} / ${h}))`;
}
