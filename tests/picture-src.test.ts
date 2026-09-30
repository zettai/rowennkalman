import { pictureSrc } from "@/components/site/content";
import { MemoryStore, setStoreForTests } from "@/lib/store";

const img = { key: "art/p.jpg", width: 2000, height: 1000, alt: "" };

describe("pictureSrc (the ROWENNKALMAN_IMAGE_CDN_URL switch)", () => {
  const saved = process.env.ROWENNKALMAN_IMAGE_CDN_URL;
  beforeAll(() => setStoreForTests(new MemoryStore()));
  afterAll(() => {
    setStoreForTests(undefined);
    process.env.ROWENNKALMAN_IMAGE_CDN_URL = saved;
  });

  it("uses the pre-made sizes through the Worker when the switch is on and the picture has them", () => {
    process.env.ROWENNKALMAN_IMAGE_CDN_URL = "https://img.test/";
    expect(pictureSrc({ ...img, sizes: [640, 960] })).toEqual({
      src: "https://img.test/art/p-640.webp",
      srcSet: "https://img.test/art/p-640.webp 640w, https://img.test/art/p-960.webp 960w, https://img.test/art/p.jpg 2000w",
    });
  });

  it("falls back to the original (Netlify resizing) without sizes or with the switch off", () => {
    process.env.ROWENNKALMAN_IMAGE_CDN_URL = "https://img.test";
    expect(pictureSrc(img)).toEqual({ src: "/memory-images/art/p.jpg" });
    process.env.ROWENNKALMAN_IMAGE_CDN_URL = "";
    expect(pictureSrc({ ...img, sizes: [640] })).toEqual({ src: "/memory-images/art/p.jpg" });
  });
});
