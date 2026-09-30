import type { Content } from "@/lib/content/schema";

export interface ContentStore {
  getContent(): Promise<Content>;
  /** Throws ConflictError if expectedUpdatedAt is not the stored updatedAt. Returns what was saved. */
  putContent(next: Content, expectedUpdatedAt: string): Promise<Content>;
  putImage(key: string, bytes: Uint8Array, contentType: "image/jpeg"): Promise<void>;
  deleteImage(key: string): Promise<void>;
  imageUrl(key: string): string;
  /**
   * Addition to the requested interface: lists stored image keys so uploads
   * that were never saved into content can be swept (see sweepOrphanImages).
   */
  listImages(): Promise<StoredImage[]>;
  /**
   * Stores a pre-made WebP size of a picture (key from sizeKey() in src/lib/images/sizes.ts).
   * Sizes are not listed by listImages, and deleteImage(original) deletes them too.
   */
  putImageSize(key: string, bytes: Uint8Array): Promise<void>;
  /** Keeps a record of a failed upload, privately (never under art/). See docs/IMAGES.md. */
  putUploadFailure(record: UploadFailure): Promise<void>;
  listUploadFailures(): Promise<UploadFailure[]>;
}

/** One failed upload: where it failed and enough context to fix it. Never the picture itself. */
export type UploadFailure = { at: string; id: string; step: string; message: string } & Record<string, unknown>;

export type StoredImage = { key: string; lastModified: number };

export class ConflictError extends Error {
  readonly currentUpdatedAt: string;
  constructor(currentUpdatedAt: string) {
    super("Content was changed by someone else since it was loaded.");
    this.name = "ConflictError";
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

export class StoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StoreError";
  }
}
