import { collectImageKeys, ContentSchema, type Content, type PageKey } from "@/lib/content/schema";
import { ConflictError, type ContentStore } from "./types";

/** Unsaved uploads younger than this are left alone by the sweep (someone may still be editing). */
export const ORPHAN_GRACE_MS = 6 * 60 * 60 * 1000;

export type SaveResult = { content: Content; deletedImages: string[] };

/**
 * Saves content and removes images the new version no longer references
 * (deleted artworks, replaced or removed images). Throws ConflictError if stale.
 */
export async function saveContent(store: ContentStore, next: Content, expectedUpdatedAt: string): Promise<SaveResult> {
  const before = await store.getContent();
  if (before.updatedAt !== expectedUpdatedAt) throw new ConflictError(before.updatedAt);
  // Tokens only move forward, so if this put succeeds, `before` is exactly what it replaced.
  const saved = await store.putContent(next, expectedUpdatedAt);
  const keep = collectImageKeys(saved);
  const removed = [...collectImageKeys(before)].filter((k) => !keep.has(k));
  const deletedImages: string[] = [];
  for (const key of removed) {
    try {
      await store.deleteImage(key);
      deletedImages.push(key);
    } catch (err) {
      // Not fatal: the content is saved; sweepOrphanImages will retry later.
      console.error(`Could not delete unused image ${key}`, err);
    }
  }
  return { content: saved, deletedImages };
}

/** Replaces one page's part of the content and validates the result. */
export function withPage(current: Content, page: PageKey, value: unknown): Content {
  return ContentSchema.parse({ ...current, [page]: value });
}

/**
 * Deletes stored images that no content references and that are older than
 * the grace period: uploads that were never saved, and deletes that failed.
 */
export async function sweepOrphanImages(
  store: ContentStore,
  options: { graceMs?: number; now?: number } = {},
): Promise<string[]> {
  const graceMs = options.graceMs ?? ORPHAN_GRACE_MS;
  const now = options.now ?? Date.now();
  const referenced = collectImageKeys(await store.getContent());
  const deleted: string[] = [];
  for (const img of await store.listImages()) {
    if (referenced.has(img.key) || now - img.lastModified < graceMs) continue;
    try {
      await store.deleteImage(img.key);
      deleted.push(img.key);
    } catch (err) {
      console.error(`Could not sweep image ${img.key}`, err);
    }
  }
  return deleted;
}
