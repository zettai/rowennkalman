import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import seed from "@content/seed.json";
import { ContentSchema, collectImageKeys, type Content } from "@/lib/content/schema";
import { setPath } from "@/lib/content/fields";
import { ConflictError, FileStore, MemoryStore, S3Store, type ContentStore } from "@/lib/store";
import { s3ConfigFromEnv, createStoreFromEnv } from "@/lib/store";
import { saveContent, sweepOrphanImages, withPage } from "@/lib/store/save";
import { FakeS3 } from "./helpers/fake-s3";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x02, 0xff, 0xd9]);
const seedContent = () => ContentSchema.parse(structuredClone(seed));

const S3_CONFIG = {
  endpoint: "https://s3.invalid",
  region: "test",
  bucket: "bucket",
  accessKeyId: "x",
  secretAccessKey: "y",
  publicImageBase: "https://images.invalid/",
};

type Harness = { store: ContentStore; hasImage(key: string): Promise<boolean>; cleanup(): void; fake?: FakeS3 };

const harnesses: Record<string, () => Harness> = {
  MemoryStore: () => {
    const store = new MemoryStore();
    return { store, hasImage: async (k) => store.images.has(k), cleanup: () => {} };
  },
  FileStore: () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rk-store-"));
    const store = new FileStore(dir);
    return {
      store,
      hasImage: async (k) => existsSync(path.join(dir, k)),
      cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
  },
  S3Store: () => {
    const fake = new FakeS3();
    fake.put("content.json", JSON.stringify(seed));
    for (const k of collectImageKeys(seedContent())) fake.put(k, JPEG, new Date(0));
    const store = new S3Store(S3_CONFIG, fake);
    return { store, fake, hasImage: async (k) => fake.objects.has(k), cleanup: () => {} };
  },
};

describe.each(Object.keys(harnesses))("%s", (name) => {
  let h: Harness;
  beforeEach(() => {
    h = harnesses[name]!();
  });
  afterEach(() => h.cleanup());

  it("returns valid content (seeded) and saves with a fresh token", async () => {
    const c = await h.store.getContent();
    expect(c.home.heroTitle).toBe(seed.home.heroTitle);
    const next = setPath(c, "home.heroTitle", "New title");
    const saved = await h.store.putContent(next, c.updatedAt);
    expect(saved.home.heroTitle).toBe("New title");
    expect(saved.updatedAt).not.toBe(c.updatedAt);
    expect(Date.parse(saved.updatedAt)).toBeGreaterThan(Date.parse(c.updatedAt));
    expect((await h.store.getContent()).home.heroTitle).toBe("New title");
  });

  it("throws ConflictError on a stale token and keeps the newer content", async () => {
    const tabA = await h.store.getContent();
    const tabB = await h.store.getContent();
    await h.store.putContent(setPath(tabA, "home.heroTitle", "From tab A"), tabA.updatedAt);
    await expect(h.store.putContent(setPath(tabB, "home.heroTitle", "From tab B"), tabB.updatedAt)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect((await h.store.getContent()).home.heroTitle).toBe("From tab A");
  });

  it("serialises concurrent writes: exactly one of two racing saves wins", async () => {
    const c = await h.store.getContent();
    const results = await Promise.allSettled([
      h.store.putContent(setPath(c, "home.heroTitle", "one"), c.updatedAt),
      h.store.putContent(setPath(c, "home.heroTitle", "two"), c.updatedAt),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);
  });

  it("rejects invalid content on write", async () => {
    const c = await h.store.getContent();
    const bad = setPath(c, "home.heroImage", { key: "evil/../../x", width: 1, height: 1, alt: "" });
    await expect(h.store.putContent(bad as Content, c.updatedAt)).rejects.toThrow(/Invalid content/);
  });

  it("refuses image keys outside art/", async () => {
    await expect(h.store.putImage("../content.json", JPEG, "image/jpeg")).rejects.toThrow(/unexpected image key/);
    await expect(h.store.deleteImage("content.json")).rejects.toThrow(/unexpected image key/);
  });

  it("deleting an artwork deletes its image", async () => {
    const c = await h.store.getContent();
    const victim = c.portfolio.artworks[1]!;
    expect(await h.hasImage(victim.image.key)).toBe(true);
    const next = withPage(c, "portfolio", {
      ...c.portfolio,
      artworks: c.portfolio.artworks.filter((a) => a.id !== victim.id),
    });
    const { deletedImages } = await saveContent(h.store, next, c.updatedAt);
    expect(deletedImages).toEqual([victim.image.key]);
    expect(await h.hasImage(victim.image.key)).toBe(false);
    // Other images are untouched.
    for (const k of collectImageKeys(await h.store.getContent())) expect(await h.hasImage(k)).toBe(true);
  });

  it("replacing or removing an image deletes the old key", async () => {
    const c = await h.store.getContent();
    const oldHero = c.home.heroImage!.key;
    const oldArt = c.portfolio.artworks[0]!.image.key;
    await h.store.putImage("art/new-hero.jpg", JPEG, "image/jpeg");
    await h.store.putImage("art/new-art.jpg", JPEG, "image/jpeg");
    let next = setPath(c, "home.heroImage", { key: "art/new-hero.jpg", width: 10, height: 10, alt: "x" });
    next = setPath(next, "portfolio.artworks", [
      { ...c.portfolio.artworks[0]!, image: { key: "art/new-art.jpg", width: 10, height: 10, alt: "y" } },
      ...c.portfolio.artworks.slice(1),
    ]);
    next = setPath(next, "about.images", []);
    const { content, deletedImages } = await saveContent(h.store, next, c.updatedAt);
    expect(deletedImages.sort()).toEqual([oldHero, oldArt, "art/seed-about.jpg"].sort());
    for (const k of deletedImages) expect(await h.hasImage(k)).toBe(false);
    expect(await h.hasImage("art/new-hero.jpg")).toBe(true);
    expect(content.home.heroImage!.key).toBe("art/new-hero.jpg");
  });

  it("does not delete an image that is still used elsewhere", async () => {
    const c = await h.store.getContent();
    const shared = c.portfolio.artworks[0]!.image;
    let next = setPath(c, "contact.image", shared);
    next = setPath(next, "portfolio.artworks", c.portfolio.artworks.slice(1));
    const { deletedImages } = await saveContent(h.store, next, c.updatedAt);
    expect(deletedImages).toEqual([]);
    expect(await h.hasImage(shared.key)).toBe(true);
  });

  it("a conflicting save deletes nothing", async () => {
    const c = await h.store.getContent();
    await h.store.putContent(setPath(c, "home.heroTitle", "other tab"), c.updatedAt);
    const next = setPath(c, "portfolio.artworks", []);
    await expect(saveContent(h.store, next, c.updatedAt)).rejects.toBeInstanceOf(ConflictError);
    for (const a of c.portfolio.artworks) expect(await h.hasImage(a.image.key)).toBe(true);
  });

  it("sweeps unsaved uploads after the grace period, and nothing that is referenced", async () => {
    await h.store.putImage("art/abandoned.jpg", JPEG, "image/jpeg");
    // Within the grace period: kept.
    expect(await sweepOrphanImages(h.store, { graceMs: 60_000 })).toEqual([]);
    expect(await h.hasImage("art/abandoned.jpg")).toBe(true);
    // Later: swept, and every referenced image survives.
    const swept = await sweepOrphanImages(h.store, { graceMs: 60_000, now: Date.now() + 120_000 });
    expect(swept).toEqual(["art/abandoned.jpg"]);
    expect(await h.hasImage("art/abandoned.jpg")).toBe(false);
    const stored = (await h.store.listImages()).map((i) => i.key).sort();
    expect(stored).toEqual([...collectImageKeys(await h.store.getContent())].sort());
  });
});

describe("FileStore specifics", () => {
  it("seeds content and seed images into the data dir on first read", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rk-seed-"));
    try {
      const store = new FileStore(dir);
      const c = await store.getContent();
      expect(JSON.parse(readFileSync(path.join(dir, "content.json"), "utf8")).updatedAt).toBe(c.updatedAt);
      for (const k of collectImageKeys(c)) expect(existsSync(path.join(dir, k))).toBe(true);
      expect(store.imageUrl("art/a.jpg")).toBe("/api/dev-images/art/a.jpg");
      expect(await store.readImage("art/seed-hero.jpg")).not.toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("S3Store specifics", () => {
  it("builds public image URLs from the base", () => {
    expect(new S3Store(S3_CONFIG, new FakeS3()).imageUrl("art/a.jpg")).toBe("https://images.invalid/art/a.jpg");
  });

  it("detects a write from another instance between read and write (If-Match)", async () => {
    const fake = new FakeS3();
    fake.put("content.json", JSON.stringify(seed));
    const a = new S3Store(S3_CONFIG, fake);
    const c = await a.getContent();
    // Simulate another serverless instance writing after our read: bump the etag only.
    const realSend = fake.send.bind(fake);
    let injected = false;
    fake.send = async (cmd: unknown) => {
      const out = await realSend(cmd);
      if (!injected && fake.calls.at(-1) === "get content.json" && fake.calls.length > 1) {
        injected = true;
        fake.put("content.json", JSON.stringify({ ...seed, updatedAt: "2026-02-01T00:00:00.000Z" }));
      }
      return out;
    };
    await expect(a.putContent(setPath(c, "home.heroTitle", "x"), c.updatedAt)).rejects.toBeInstanceOf(ConflictError);
  });

  it("falls back to plain writes when the provider lacks If-Match", async () => {
    const fake = new FakeS3();
    fake.supportsIfMatch = false;
    fake.put("content.json", JSON.stringify(seed));
    const s = new S3Store(S3_CONFIG, fake);
    const c = await s.getContent();
    const saved = await s.putContent(setPath(c, "home.heroTitle", "ok"), c.updatedAt);
    expect(saved.home.heroTitle).toBe("ok");
    expect((await s.getContent()).home.heroTitle).toBe("ok");
  });

  it("explains a missing content.json", async () => {
    await expect(new S3Store(S3_CONFIG, new FakeS3()).getContent()).rejects.toThrow(/seed-s3/);
  });
});

describe("getStore selection", () => {
  const full = {
    ROWENNKALMAN_S3_ENDPOINT: "https://s3.invalid",
    ROWENNKALMAN_S3_REGION: "r",
    ROWENNKALMAN_S3_BUCKET: "b",
    ROWENNKALMAN_S3_ACCESS_KEY: "a",
    ROWENNKALMAN_S3_SECRET_KEY: "s",
    ROWENNKALMAN_PUBLIC_IMAGE_BASE: "https://img.invalid",
  };
  it("uses S3 when all S3 vars are set", () => {
    expect(createStoreFromEnv(full)).toBeInstanceOf(S3Store);
  });
  it("uses FileStore when none are set", () => {
    expect(createStoreFromEnv({})).toBeInstanceOf(FileStore);
    expect(s3ConfigFromEnv({})).toBeNull();
  });
  it("fails loudly when S3 is half configured", () => {
    expect(() => createStoreFromEnv({ ...full, ROWENNKALMAN_S3_SECRET_KEY: "" })).toThrow(/ROWENNKALMAN_S3_SECRET_KEY/);
  });
});

describe("getStore", () => {
  it("uses the local file store when no bucket is configured, and keeps one per process", async () => {
    const { getStore, setStoreForTests, FileStore } = await import("@/lib/store");
    setStoreForTests(undefined);
    const a = getStore();
    expect(a).toBeInstanceOf(FileStore);
    expect(getStore()).toBe(a);
    setStoreForTests(undefined);
  });
});

describe.each(Object.keys(harnesses))("%s: picture sizes and upload failures", (name) => {
  let h: Harness;
  beforeEach(() => {
    h = harnesses[name]!();
  });
  afterEach(() => h.cleanup());

  it("keeps sizes next to the original, hides them from listImages, and deletes them with it", async () => {
    await h.store.putImage("art/new.jpg", JPEG, "image/jpeg");
    await h.store.putImageSize("art/new-640.webp", new Uint8Array([1, 2]));
    await h.store.putImageSize("art/new-960.webp", new Uint8Array([3]));
    expect(await h.hasImage("art/new-640.webp")).toBe(true);
    expect((await h.store.listImages()).map((i) => i.key)).toContain("art/new.jpg");
    expect((await h.store.listImages()).map((i) => i.key).filter((k) => k.endsWith(".webp"))).toEqual([]);
    await h.store.deleteImage("art/new.jpg");
    expect(await h.hasImage("art/new.jpg")).toBe(false);
    expect(await h.hasImage("art/new-640.webp")).toBe(false);
    expect(await h.hasImage("art/new-960.webp")).toBe(false);
  });

  it("refuses size keys that are not art/<name>-<width>.webp", async () => {
    await expect(h.store.putImageSize("content.json", new Uint8Array([1]))).rejects.toThrow(/size key/);
    await expect(h.store.putImageSize("art/x.jpg", new Uint8Array([1]))).rejects.toThrow(/size key/);
  });

  it("keeps upload failures outside art/ and lists them newest first", async () => {
    await h.store.putUploadFailure({ at: "2026-09-30T10:00:00.000Z", id: "u-aaaa", step: "send", message: "first" });
    await h.store.putUploadFailure({ at: "2026-09-30T11:00:00.000Z", id: "u-bbbb", step: "sizes", message: "second" });
    expect((await h.store.listUploadFailures()).map((f) => f.id)).toEqual(["u-bbbb", "u-aaaa"]);
    if (h.fake) {
      const keys = [...h.fake.objects.keys()].filter((k) => k.startsWith("logs/"));
      expect(keys).toEqual(["logs/upload-failures/2026-09-30T10-00-00-000Z-u-aaaa.json", "logs/upload-failures/2026-09-30T11-00-00-000Z-u-bbbb.json"]);
    }
  });
});

it("the orphan sweep never touches sizes on their own, and sweeps them with an orphan original", async () => {
  const store = new MemoryStore(undefined, { now: () => 10 * 24 * 3600 * 1000 });
  store.images.set("art/orphan.jpg", { bytes: JPEG, lastModified: 0 });
  store.images.set("art/orphan-640.webp", { bytes: JPEG, lastModified: 0 });
  const used = [...collectImageKeys(await store.getContent())][0]!;
  const usedSize = used.replace(/\.jpg$/, "-640.webp");
  store.images.set(usedSize, { bytes: JPEG, lastModified: 0 });
  expect(await sweepOrphanImages(store)).toEqual(["art/orphan.jpg"]);
  expect(store.images.has("art/orphan-640.webp")).toBe(false);
  expect(store.images.has(usedSize)).toBe(true);
});
