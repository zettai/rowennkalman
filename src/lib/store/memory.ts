import type { Content } from "@/lib/content/schema";
import type { ContentStore, StoredImage } from "./types";
import { assertImageKey, createMutex, parseContent, prepareWrite, seedContent } from "./common";

/** In-memory store for tests. Starts from the seed (without seed image bytes) unless given content. */
export class MemoryStore implements ContentStore {
  private content: Content;
  readonly images = new Map<string, { bytes: Uint8Array; lastModified: number }>();
  private readonly lock = createMutex();
  private readonly now: () => number;

  constructor(initial?: Content, options: { now?: () => number; withSeedImages?: boolean } = {}) {
    this.now = options.now ?? Date.now;
    this.content = initial ? parseContent(structuredClone(initial), "given to MemoryStore") : seedContent();
    if (options.withSeedImages ?? true) {
      for (const img of [
        this.content.home.heroImage,
        this.content.contact.image,
        this.content.research.image,
        ...this.content.about.images,
        ...this.content.portfolio.artworks.map((a) => a.image),
      ]) {
        if (img) this.images.set(img.key, { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), lastModified: 0 });
      }
    }
  }

  async getContent(): Promise<Content> {
    return structuredClone(this.content);
  }

  putContent(next: Content, expectedUpdatedAt: string): Promise<Content> {
    return this.lock(async () => {
      this.content = prepareWrite(this.content, structuredClone(next), expectedUpdatedAt, this.now);
      return structuredClone(this.content);
    });
  }

  async putImage(key: string, bytes: Uint8Array): Promise<void> {
    assertImageKey(key);
    this.images.set(key, { bytes: new Uint8Array(bytes), lastModified: this.now() });
  }

  async deleteImage(key: string): Promise<void> {
    assertImageKey(key);
    this.images.delete(key);
  }

  imageUrl(key: string): string {
    return `/memory-images/${key}`;
  }

  async listImages(): Promise<StoredImage[]> {
    return [...this.images].map(([key, v]) => ({ key, lastModified: v.lastModified }));
  }
}
