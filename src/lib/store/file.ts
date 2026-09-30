import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Content } from "@/lib/content/schema";
import { collectImageKeys } from "@/lib/content/schema";
import type { ContentStore, StoredImage } from "./types";
import { assertImageKey, createMutex, parseContent, prepareWrite, seedContent } from "./common";

/** Where FileStore serves images from (see src/app/api/dev-images). */
export const DEV_IMAGE_ROUTE = "/api/dev-images";

// One lock per data directory, shared by every FileStore instance in the process.
const locks = new Map<string, ReturnType<typeof createMutex>>();

/**
 * Local development store: <dir>/content.json and <dir>/art/*.jpg.
 * Seeded from content/seed.json and content/seed-images on first read.
 */
export class FileStore implements ContentStore {
  private readonly dir: string;
  private readonly seedImagesDir: string;
  private readonly lock: ReturnType<typeof createMutex>;

  constructor(dir: string, options: { seedImagesDir?: string } = {}) {
    this.dir = path.resolve(dir);
    this.seedImagesDir = options.seedImagesDir ?? path.join(process.cwd(), "content", "seed-images");
    let lock = locks.get(this.dir);
    if (!lock) locks.set(this.dir, (lock = createMutex()));
    this.lock = lock;
  }

  private get contentPath() {
    return path.join(this.dir, "content.json");
  }

  private imagePath(key: string) {
    assertImageKey(key);
    return path.join(this.dir, key); // key is "art/<safe name>.jpg"
  }

  private async atomicWrite(file: string, data: string | Uint8Array) {
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, file);
  }

  private async readOrSeed(): Promise<Content> {
    try {
      return parseContent(JSON.parse(await readFile(this.contentPath, "utf8")), `in ${this.contentPath}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    const seed = seedContent();
    await mkdir(path.join(this.dir, "art"), { recursive: true });
    for (const key of collectImageKeys(seed)) {
      const src = path.join(this.seedImagesDir, key.replace(/^art\//, ""));
      await copyFile(src, this.imagePath(key)).catch(() => undefined);
    }
    await this.atomicWrite(this.contentPath, JSON.stringify(seed, null, 2));
    return seed;
  }

  getContent(): Promise<Content> {
    return this.lock(() => this.readOrSeed());
  }

  putContent(next: Content, expectedUpdatedAt: string): Promise<Content> {
    return this.lock(async () => {
      const saved = prepareWrite(await this.readOrSeed(), next, expectedUpdatedAt);
      await this.atomicWrite(this.contentPath, JSON.stringify(saved, null, 2));
      return saved;
    });
  }

  async putImage(key: string, bytes: Uint8Array): Promise<void> {
    await this.atomicWrite(this.imagePath(key), bytes);
  }

  async deleteImage(key: string): Promise<void> {
    await rm(this.imagePath(key), { force: true });
  }

  /** Reads image bytes (for the dev image route). Returns null if missing. */
  async readImage(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.imagePath(key)));
    } catch {
      return null;
    }
  }

  imageUrl(key: string): string {
    return `${DEV_IMAGE_ROUTE}/${key}`;
  }

  async listImages(): Promise<StoredImage[]> {
    const artDir = path.join(this.dir, "art");
    let names: string[];
    try {
      names = await readdir(artDir);
    } catch {
      return [];
    }
    const out: StoredImage[] = [];
    for (const name of names) {
      if (!name.endsWith(".jpg")) continue;
      const s = await stat(path.join(artDir, name));
      out.push({ key: `art/${name}`, lastModified: s.mtimeMs });
    }
    return out;
  }
}
