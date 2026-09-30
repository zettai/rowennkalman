import { randomUUID } from "node:crypto";
import { z } from "zod";
import { collectImageKeys, IMAGE_KEY_PATTERN, isPageKey, type Content, type ImageRef } from "@/lib/content/schema";
import { ConflictError, type ContentStore } from "@/lib/store";
import { saveContent, sweepOrphanImages, withPage } from "@/lib/store/save";
import { checkJpeg, MAX_UPLOAD_BYTES } from "@/lib/upload/verify";

/**
 * Framework-free handlers behind the admin API routes, so they can be unit
 * tested with MemoryStore. Routes add auth, revalidation and HTTP plumbing.
 */

export type ImageUrls = Record<string, string>;

export function imageUrlsFor(store: ContentStore, content: Content): ImageUrls {
  return Object.fromEntries([...collectImageKeys(content)].map((k) => [k, store.imageUrl(k)]));
}

type HandlerResult = {
  status: number;
  body: unknown;
  changed?: boolean;
  /** For the save log: the page as it was before this save (not sent to the browser). */
  previous?: unknown;
};

const SaveBody = z.object({
  page: z.string(),
  value: z.unknown(),
  expectedUpdatedAt: z.string(),
});

export async function handleSave(store: ContentStore, raw: unknown): Promise<HandlerResult> {
  const parsed = SaveBody.safeParse(raw);
  if (!parsed.success || !isPageKey(parsed.data.page)) {
    return { status: 400, body: { error: "invalid", message: "The request was not understood." } };
  }
  const { page, value, expectedUpdatedAt } = parsed.data;
  const current = await store.getContent();
  if (current.updatedAt !== expectedUpdatedAt) {
    return { status: 409, body: { error: "conflict", currentUpdatedAt: current.updatedAt } };
  }
  let next: Content;
  try {
    next = withPage(current, page, value);
  } catch (err) {
    const issues = err instanceof z.ZodError ? err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) : [];
    return { status: 400, body: { error: "invalid", message: "Some fields could not be saved.", issues } };
  }
  try {
    const { content, deletedImages } = await saveContent(store, next, expectedUpdatedAt);
    // Abandoned uploads are cleaned up by the route after the response (sweepAbandonedUploads),
    // so the editor isn't kept waiting for a listing of the whole bucket.
    return {
      status: 200,
      body: { content, imageUrls: imageUrlsFor(store, content), deletedImages },
      changed: true,
      previous: (current as Record<string, unknown>)[page],
    };
  } catch (err) {
    if (err instanceof ConflictError) return { status: 409, body: { error: "conflict", currentUpdatedAt: err.currentUpdatedAt } };
    throw err;
  }
}

export async function handleUpload(
  store: ContentStore,
  file: { size: number; arrayBuffer(): Promise<ArrayBuffer> } | null,
  alt: unknown,
): Promise<HandlerResult> {
  if (!file) return { status: 400, body: { error: "missing", message: "No picture was received." } };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { status: 413, body: { error: "too-large", message: "That picture is too large (over 5 MB) even after shrinking." } };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkJpeg(bytes);
  if (!check.ok) return { status: check.reason === "too-large" ? 413 : 415, body: { error: check.reason, message: check.message } };
  const key = `art/${randomUUID()}.jpg`;
  await store.putImage(key, bytes, "image/jpeg");
  const image: ImageRef = {
    key,
    width: check.width,
    height: check.height,
    alt: typeof alt === "string" ? alt.slice(0, 500) : "",
  };
  return { status: 201, body: { image, url: store.imageUrl(key) } };
}

/** Deletes an upload that was discarded before saving. Refuses keys the saved content still uses. */
export async function handleDiscardUpload(store: ContentStore, key: unknown): Promise<HandlerResult> {
  if (typeof key !== "string" || !IMAGE_KEY_PATTERN.test(key)) {
    return { status: 400, body: { error: "invalid", message: "Unknown picture." } };
  }
  if (collectImageKeys(await store.getContent()).has(key)) {
    return { status: 409, body: { error: "in-use", message: "That picture is still used on the site." } };
  }
  await store.deleteImage(key);
  return { status: 200, body: { deleted: key } };
}

/** Removes uploads never saved into content (after a grace period). Never throws. */
export async function sweepAbandonedUploads(store: ContentStore): Promise<string[]> {
  return sweepOrphanImages(store).catch((err) => {
    console.error("Orphan sweep failed", err);
    return [];
  });
}
