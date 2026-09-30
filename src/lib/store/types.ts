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
}

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
