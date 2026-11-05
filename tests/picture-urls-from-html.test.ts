import { pictureUrlsFromHtml } from "../scripts/picture-urls-from-html.js";

const FIXTURE = `<!doctype html>
<html>
<body>
  <img
    src="https://img.rowennkalman.com/art/hero.webp"
    srcset="https://img.rowennkalman.com/art/hero.webp 640w,
      https://img.rowennkalman.com/art/wide.jpg 1280w,
      https://img.rowennkalman.com/art/tall.webp 1920w,
      https://cdn.example.com/other.webp 1x,
      https://img.rowennkalman.com/art/detail.webp 2560w"
  />
  <link
    rel="preload"
    as="image"
    imageSrcSet="https://img.rowennkalman.com/art/preload.webp 640w,
      https://img.rowennkalman.com/art/hero.webp 1280w"
  />
  <link rel="stylesheet" href="/styles.css" imagesrcset="https://img.rowennkalman.com/art/skip.webp 1x" />
</body>
</html>`;

describe("pictureUrlsFromHtml", () => {
  it("extracts distinct art URLs from img and preload link attributes", () => {
    expect(pictureUrlsFromHtml(FIXTURE)).toEqual([
      "https://img.rowennkalman.com/art/hero.webp",
      "https://img.rowennkalman.com/art/wide.jpg",
      "https://img.rowennkalman.com/art/tall.webp",
      "https://img.rowennkalman.com/art/detail.webp",
      "https://img.rowennkalman.com/art/preload.webp",
    ]);
  });

  it("never returns a whole srcset attribute value as one URL", () => {
    for (const url of pictureUrlsFromHtml(FIXTURE)) {
      expect(url).not.toMatch(/,/);
      expect(url).not.toMatch(/\s+\d+w$/);
    }
  });

  it("decodes &amp; in art URLs", () => {
    const html =
      '<img src="https://img.rowennkalman.com/art/a&amp;b.webp" srcset="https://img.rowennkalman.com/art/a&amp;b.webp 640w" />';
    expect(pictureUrlsFromHtml(html)).toEqual(["https://img.rowennkalman.com/art/a&b.webp"]);
  });
});
