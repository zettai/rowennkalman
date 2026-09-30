import sharp from "sharp";
import { makeSizes, sizeKey, srcSetFor, widthsFor, SIZE_WIDTHS } from "@/lib/images/sizes";
import { backfillSizes, imagesIn, withSizes } from "@/lib/images/backfill";
import { handleClientLog, handleUpload, uploadIdFrom } from "@/lib/admin/handlers";
import { createRateLimiter } from "@/lib/rate-limit";
import { MemoryStore } from "@/lib/store";
import { tinyJpeg } from "./helpers/jpeg-fixtures";

const jpeg = async (width: number, height: number) =>
  new Uint8Array(await sharp({ create: { width, height, channels: 3, background: "#7a6" } }).jpeg().toBuffer());
const asFile = (bytes: Uint8Array) => ({ size: bytes.length, arrayBuffer: async () => bytes.slice().buffer });

describe("sizes", () => {
  it("names sizes after the original and never enlarges", () => {
    expect(sizeKey("art/abc.jpg", 640)).toBe("art/abc-640.webp");
    expect(widthsFor(2800)).toEqual([...SIZE_WIDTHS]);
    expect(widthsFor(1000)).toEqual([640, 960]);
    expect(widthsFor(640)).toEqual([]);
  });

  it("lists the sizes then the original in the srcset", () => {
    expect(srcSetFor("https://img.test/", { key: "art/a.jpg", width: 2000, sizes: [640, 960] })).toBe(
      "https://img.test/art/a-640.webp 640w, https://img.test/art/a-960.webp 960w, https://img.test/art/a.jpg 2000w",
    );
    expect(srcSetFor("https://img.test", { key: "art/a.jpg", width: 2000 })).toBeUndefined();
  });

  it("makes real WebP files at the right widths (sharp)", async () => {
    const made = await makeSizes(await jpeg(1400, 700), 1400);
    expect(made.map((m) => m.width)).toEqual([640, 960, 1280]);
    for (const m of made) {
      const meta = await sharp(Buffer.from(m.bytes)).metadata();
      expect(meta).toMatchObject({ format: "webp", width: m.width });
    }
  });
});

describe("upload makes and records sizes", () => {
  const fakeMake = async (_: Uint8Array, width: number) => widthsFor(width).map((w) => ({ width: w, bytes: new Uint8Array([w % 256]) }));

  it("stores the sizes and puts their widths on the picture", async () => {
    const store = new MemoryStore();
    const res = await handleUpload(store, asFile(tinyJpeg(1000, 800)), "alt", { id: "u-test1", makeSizes: fakeMake });
    expect(res.status).toBe(201);
    const body = res.body as { image: { key: string; sizes?: number[] }; id: string };
    expect(body.id).toBe("u-test1");
    expect(body.image.sizes).toEqual([640, 960]);
    expect(store.images.has(sizeKey(body.image.key, 640))).toBe(true);
    expect(store.failures).toEqual([]);
  });

  it("still succeeds without sizes when making them fails, and keeps a failure record", async () => {
    const store = new MemoryStore();
    const res = await handleUpload(store, asFile(tinyJpeg(1000, 800)), "", {
      id: "u-test2",
      makeSizes: async () => {
        throw new Error("sharp exploded");
      },
    });
    expect(res.status).toBe(201);
    expect((res.body as { image: { sizes?: number[] } }).image.sizes).toBeUndefined();
    expect(store.failures).toEqual([expect.objectContaining({ id: "u-test2", step: "sizes", detail: "Error: sharp exploded" })]);
  });

  it("keeps a failure record with the upload's reference when the picture is refused", async () => {
    const store = new MemoryStore();
    const res = await handleUpload(store, asFile(new Uint8Array([1, 2, 3])), "", { id: "u-test3" });
    expect(res.status).toBe(415);
    expect(res.body).toMatchObject({ id: "u-test3" });
    expect(store.failures).toEqual([expect.objectContaining({ id: "u-test3", step: "check", source: "server" })]);
  });

  it("only accepts upload ids that look like ours", () => {
    expect(uploadIdFrom("u-abc123")).toBe("u-abc123");
    expect(uploadIdFrom("../../etc")).toMatch(/^u-[0-9a-f]{8}$/);
  });
});

describe("browser failure reports", () => {
  const headers = new Headers({ "user-agent": "TestPhone", "x-forwarded-for": "1.2.3.4" });
  it("keeps a valid report and refuses junk", async () => {
    const store = new MemoryStore();
    const ok = await handleClientLog(store, { id: "u-abcd", step: "send", message: "network error", fileBytes: 12 }, headers, createRateLimiter({ limit: 5, windowMs: 1000 }));
    expect(ok.status).toBe(204);
    expect(store.failures[0]).toMatchObject({ id: "u-abcd", step: "send", source: "browser", userAgent: "TestPhone" });
    expect((await handleClientLog(store, { id: "nope", step: "send", message: "x" }, headers)).status).toBe(400);
  });
  it("is rate limited", async () => {
    const store = new MemoryStore();
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const body = { id: "u-abcd", step: "prepare", message: "x" };
    expect((await handleClientLog(store, body, headers, limiter)).status).toBe(204);
    expect((await handleClientLog(store, body, headers, limiter)).status).toBe(429);
  });
});

describe("backfill", () => {
  const original = async () => jpeg(2000, 1000);
  // The seed's placeholders are narrower than 640 px (nothing to make); use wide pictures.
  const wideStore = async () => {
    const seedContent = await new MemoryStore().getContent();
    const widen = (v: unknown): unknown =>
      Array.isArray(v) ? v.map(widen) : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "width" ? 2000 : widen(x)]))
        : v;
    return new MemoryStore(widen(seedContent) as never);
  };

  it("dry run plans without changing anything", async () => {
    const store = await wideStore();
    const before = await store.getContent();
    const report = await backfillSizes(store, { apply: false, fetchOriginal: original });
    expect(report.planned.length).toBe(imagesIn(before).length);
    expect(report.planned.length).toBeGreaterThan(1);
    expect((await store.getContent()).updatedAt).toBe(before.updatedAt);
  });

  it("applies: stores sizes, records them everywhere the picture is used, then has nothing left to do", async () => {
    const store = await wideStore();
    const fetched: string[] = [];
    const report = await backfillSizes(store, {
      apply: true,
      fetchOriginal: async (k) => (fetched.push(k), original()),
      make: async (_b, w) => widthsFor(w).map((x) => ({ width: x, bytes: new Uint8Array([1]) })),
    });
    expect(report.made.length).toBeGreaterThan(0);
    const after = await store.getContent();
    for (const img of imagesIn(after)) expect(img.sizes).toEqual(widthsFor(img.width));
    expect(fetched.length).toBe(report.planned.length);
    const again = await backfillSizes(store, { apply: true, fetchOriginal: original });
    expect(again.planned).toEqual([]);
  });

  it("retries when an editor saves in the middle", async () => {
    const store = await wideStore();
    let interfered = false;
    const report = await backfillSizes(store, {
      apply: true,
      fetchOriginal: original,
      make: async () => [{ width: 640, bytes: new Uint8Array([1]) }],
      beforeSave: async (current) => {
        if (interfered) return;
        interfered = true;
        await store.putContent({ ...current, home: { ...current.home, heroTitle: "Edited meanwhile" } }, current.updatedAt);
      },
    });
    expect(report.savedUpdatedAt).toBeDefined();
    const after = await store.getContent();
    expect(after.home.heroTitle).toBe("Edited meanwhile");
    expect(imagesIn(after).every((i) => i.sizes?.length)).toBe(true);
  });

  it("withSizes replaces sizes only on the named pictures", () => {
    const c = { a: { key: "art/a.jpg", width: 900, height: 9, alt: "", sizes: [1] }, b: { key: "art/b.jpg", width: 900, height: 9, alt: "" } };
    const out = withSizes(c as never, new Map([["art/a.jpg", [640]]])) as unknown as typeof c;
    expect(out.a.sizes).toEqual([640]);
    expect(out.b).toEqual(c.b);
  });
});
