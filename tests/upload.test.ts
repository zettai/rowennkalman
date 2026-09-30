import { checkJpeg, MAX_UPLOAD_BYTES } from "@/lib/upload/verify";
import { handleDiscardUpload, handleUpload } from "@/lib/admin/handlers";
import { MemoryStore } from "@/lib/store";
import { exifSegment, seedJpeg, seedJpegWithExif, tinyJpeg } from "./helpers/jpeg-fixtures";

const asFile = (bytes: Uint8Array) => ({ size: bytes.length, arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer });

describe("checkJpeg", () => {
  it("accepts a clean JPEG and reads its size", () => {
    expect(checkJpeg(tinyJpeg(1200, 900))).toEqual({ ok: true, width: 1200, height: 900 });
  });
  it("accepts a real encoder's output", () => {
    expect(checkJpeg(seedJpeg("seed-art-2.jpg"))).toEqual({ ok: true, width: 520, height: 390 });
  });
  it("rejects PNG, WebP, HEIC and text by magic bytes", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    const heic = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypheic")]);
    const text = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");
    for (const bytes of [png, webp, heic, text]) expect(checkJpeg(bytes)).toMatchObject({ ok: false, reason: "not-jpeg" });
  });
  it("rejects an APP1 / EXIF segment anywhere before the image data", () => {
    expect(checkJpeg(tinyJpeg(10, 10, [exifSegment]))).toMatchObject({ ok: false, reason: "has-exif" });
    expect(checkJpeg(seedJpegWithExif())).toMatchObject({ ok: false, reason: "has-exif" });
  });
  it("rejects files over 5 MB", () => {
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set([0xff, 0xd8, 0xff, 0xe0]);
    expect(checkJpeg(big)).toMatchObject({ ok: false, reason: "too-large" });
  });
  it("rejects empty, truncated and dimensionless files", () => {
    expect(checkJpeg(new Uint8Array())).toMatchObject({ ok: false, reason: "empty" });
    expect(checkJpeg(tinyJpeg().slice(0, 30))).toMatchObject({ ok: false, reason: "corrupt" });
    expect(checkJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toMatchObject({ ok: false, reason: "corrupt" });
    expect(checkJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0xff]))).toMatchObject({ ok: false, reason: "corrupt" });
  });
  it("rejects images larger than the 2800 px browser limit", () => {
    expect(checkJpeg(tinyJpeg(4000, 3000))).toMatchObject({ ok: false, reason: "too-big-dimensions" });
    expect(checkJpeg(tinyJpeg(2800, 1)).ok).toBe(true);
  });
  it("gives every rejection a friendly message", () => {
    const r = checkJpeg(new TextEncoder().encode("hello"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/JPEG, PNG or WebP/);
  });
});

describe("upload handler", () => {
  it("stores a clean JPEG under art/<uuid>.jpg and returns the ImageRef", async () => {
    const store = new MemoryStore();
    const res = await handleUpload(store, asFile(tinyJpeg(800, 600)), "A heron");
    expect(res.status).toBe(201);
    const body = res.body as { image: { key: string; width: number; height: number; alt: string }; url: string };
    expect(body.image.key).toMatch(/^art\/[0-9a-f-]{36}\.jpg$/);
    expect(body.image).toMatchObject({ width: 800, height: 600, alt: "A heron" });
    expect(store.images.has(body.image.key)).toBe(true);
    expect(body.url).toBe(`/memory-images/${body.image.key}`);
  });
  it("stores nothing when the check fails", async () => {
    const store = new MemoryStore();
    const before = store.images.size;
    expect((await handleUpload(store, asFile(seedJpegWithExif()), "")).status).toBe(415);
    expect((await handleUpload(store, { size: MAX_UPLOAD_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) }, "")).status).toBe(413);
    expect((await handleUpload(store, null, "")).status).toBe(400);
    expect(store.images.size).toBe(before);
  });
  it("discards an unsaved upload but never an image the site uses", async () => {
    const store = new MemoryStore();
    const up = (await handleUpload(store, asFile(tinyJpeg()), "")).body as { image: { key: string } };
    expect((await handleDiscardUpload(store, up.image.key)).status).toBe(200);
    expect(store.images.has(up.image.key)).toBe(false);
    expect((await handleDiscardUpload(store, "art/seed-hero.jpg")).status).toBe(409);
    expect(store.images.has("art/seed-hero.jpg")).toBe(true);
    expect((await handleDiscardUpload(store, "../content.json")).status).toBe(400);
  });
});

describe("checkJpeg: markers without a length field", () => {
  it("skips a standalone marker (TEM) and still reads the frame size", () => {
    const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x0a, 0x00, 0x0b, 0x03, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1];
    const sos = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00];
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x01, ...sof, ...sos, 0xff, 0xd9]);
    expect(checkJpeg(bytes)).toEqual({ ok: true, width: 11, height: 10 });
  });
  it("refuses a frame header too short to hold a size", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x05, 0x08, 0x00, 0x0a, 0xff, 0xda, 0x00, 0x02]);
    expect(checkJpeg(bytes)).toMatchObject({ ok: false, reason: "corrupt" });
  });
});
