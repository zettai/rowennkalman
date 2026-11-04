import {
  LIGHTBOX_BOX_WIDTH,
  LIGHTBOX_IMAGE_ROW_HEIGHT,
  lightboxSizesForPicture,
} from "@/lib/images/lightbox-sizes";

const REM = 16;

function gutterPx(vw: number): number {
  return Math.min(Math.max(REM, vw * 0.04), REM * 3);
}

/** Mirrors the CSS in lightboxSizesForPicture (16px rem, safe-area 0). */
export function lightboxEstimateCssPx(vw: number, vh: number, picW: number, picH: number): number {
  const g = gutterPx(vw);
  const boxW = vw - 2 * g;
  const rowH = vh - 2 * g - REM - 44;
  return Math.min(boxW, (rowH * picW) / picH);
}

/** Drawn width when the caption row is present (2 grid gaps + typical text block). */
export function lightboxDrawnWithCaptionCssPx(
  vw: number,
  vh: number,
  picW: number,
  picH: number,
  textRowPx: number,
): number {
  const g = gutterPx(vw);
  const boxW = vw - 2 * g;
  const inner = vh - g - Math.max(g, 0);
  const rowH = inner - 2 * REM - 44 - textRowPx;
  return Math.min(boxW, (rowH * picW) / picH);
}

const CAPTION_TEXT_PX = 72;

describe("lightboxSizesForPicture", () => {
  it("builds min(boxWidth, rowHeight * aspect) with the gutter clamp and vh row", () => {
    const portrait = lightboxSizesForPicture(2000, 2800);
    expect(portrait).toContain(LIGHTBOX_BOX_WIDTH);
    expect(portrait).toContain("100vh");
    expect(portrait).toContain("2000 / 2800");
    expect(portrait).toMatch(/^min\(/);

    const landscape = lightboxSizesForPicture(2800, 2000);
    expect(landscape).toContain("2800 / 2000");

    const square = lightboxSizesForPicture(2000, 2000);
    expect(square).toContain("2000 / 2000");
    expect(square).toContain(LIGHTBOX_IMAGE_ROW_HEIGHT);
  });

  it("falls back to 90vw for invalid dimensions", () => {
    expect(lightboxSizesForPicture(0, 100)).toBe("90vw");
    expect(lightboxSizesForPicture(100, 0)).toBe("90vw");
    expect(lightboxSizesForPicture(Number.NaN, 100)).toBe("90vw");
  });

  it("matches reference viewports (upper-bound formula) and stays above captioned layout", () => {
    const aspect095W = 1900;
    const aspect095H = 2000;

    const laptop = lightboxEstimateCssPx(1440, 900, aspect095W, aspect095H);
    const laptopDrawn = lightboxDrawnWithCaptionCssPx(1440, 900, aspect095W, aspect095H, CAPTION_TEXT_PX);
    expect(laptop).toBeGreaterThanOrEqual(laptopDrawn);
    expect(laptop * 2).toBeLessThanOrEqual(1920);
    expect(laptop * 2).toBeGreaterThanOrEqual(laptopDrawn * 2);

    const phone = lightboxEstimateCssPx(390, 844, 2000, 2800);
    expect(phone).toBe(358);
    expect(phone * 3).toBe(1074);

    const desktopPortrait = lightboxEstimateCssPx(1920, 1080, 2000, 2800);
    const desktopLandscape = lightboxEstimateCssPx(1920, 1080, 2800, 2000);
    expect(desktopPortrait).toBeLessThanOrEqual(1280);
    expect(desktopLandscape).toBeLessThanOrEqual(1293.6);

    for (const [vw, vh, pw, ph] of [
      [1440, 900, aspect095W, aspect095H],
      [390, 844, 2000, 2800],
      [1920, 1080, 2000, 2800],
      [1920, 1080, 2800, 2000],
    ] as const) {
      const est = lightboxEstimateCssPx(vw, vh, pw, ph);
      const drawn = lightboxDrawnWithCaptionCssPx(vw, vh, pw, ph, CAPTION_TEXT_PX);
      expect(est).toBeGreaterThanOrEqual(drawn);
    }
  });
});
