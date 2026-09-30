import { randomUUID } from "node:crypto";
import { z } from "zod";
import { collectImageKeys, IMAGE_KEY_PATTERN, isPageKey, type Content, type ImageRef } from "@/lib/content/schema";
import { ConflictError, type ContentStore } from "@/lib/store";
import { saveContent, sweepOrphanImages, withPage } from "@/lib/store/save";
import { checkJpeg, MAX_UPLOAD_BYTES } from "@/lib/upload/verify";
import { makeSizes, sizeKey } from "@/lib/images/sizes";
import { logEvent } from "@/lib/log";
import { clientIp, createRateLimiter, type RateLimiter } from "@/lib/rate-limit";

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

export const UPLOAD_ID_PATTERN = /^u-[a-z0-9]{4,16}$/;

/** The id the browser gave this upload (shown to the editor on failure), or a fresh one. */
export function uploadIdFrom(raw: unknown): string {
  return typeof raw === "string" && UPLOAD_ID_PATTERN.test(raw) ? raw : `u-${randomUUID().slice(0, 8)}`;
}

type UploadDeps = { id?: string; makeSizes?: typeof makeSizes; now?: () => number };

/**
 * Checks the browser-prepared JPEG, stores it, then makes and stores its WebP sizes.
 * Logs one "upload" line either way. If only the sizes fail, the upload still succeeds: the
 * picture is served the old way (no `sizes`) and `npm run image-sizes` can add them later.
 */
export async function handleUpload(
  store: ContentStore,
  file: { size: number; arrayBuffer(): Promise<ArrayBuffer> } | null,
  alt: unknown,
  deps: UploadDeps = {},
): Promise<HandlerResult> {
  const id = deps.id ?? uploadIdFrom(undefined);
  const now = deps.now ?? (() => performance.now());
  const t0 = now();
  const ms: Record<string, number> = {};
  const fail = async (status: number, step: string, error: string, message: string, extra: Record<string, unknown> = {}) => {
    ms.total = Math.round(now() - t0);
    const record = { at: new Date().toISOString(), id, step, message, error, status, source: "server", ms, bytes: file?.size, ...extra };
    logEvent("upload", { ok: false, ...record });
    await store.putUploadFailure(record).catch((err) => console.error("Could not keep the upload failure record", err));
    return { status, body: { error, message, id } };
  };

  if (!file) return fail(400, "receive", "missing", "No picture was received.");
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, "receive", "too-large", "That picture is too large (over 5 MB) even after shrinking.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkJpeg(bytes);
  ms.check = Math.round(now() - t0);
  if (!check.ok) return fail(check.reason === "too-large" ? 413 : 415, "check", check.reason, check.message);

  const key = `art/${randomUUID()}.jpg`;
  try {
    await store.putImage(key, bytes, "image/jpeg");
  } catch (err) {
    return fail(502, "store", "store", "The picture could not be saved. Please try again.", { detail: errorText(err) });
  }
  ms.store = Math.round(now() - t0) - ms.check;

  const image: ImageRef = { key, width: check.width, height: check.height, alt: typeof alt === "string" ? alt.slice(0, 500) : "" };
  const t1 = now();
  try {
    const made = await (deps.makeSizes ?? makeSizes)(bytes, check.width);
    for (const size of made) await store.putImageSize(sizeKey(key, size.width), size.bytes);
    if (made.length) image.sizes = made.map((s) => s.width);
    ms.sizes = Math.round(now() - t1);
  } catch (err) {
    // Not fatal: the picture works without sizes. Record it so it gets fixed.
    ms.sizes = Math.round(now() - t1);
    const record = { at: new Date().toISOString(), id, step: "sizes", message: "Sizes could not be made; the picture is served without them.", error: "sizes", source: "server", key, ms, detail: errorText(err) };
    logEvent("upload", { ok: true, sizesFailed: true, ...record });
    await store.putUploadFailure(record).catch(() => undefined);
    return { status: 201, body: { image, url: store.imageUrl(key), id } };
  }
  ms.total = Math.round(now() - t0);
  logEvent("upload", { ok: true, id, key, bytes: bytes.length, width: check.width, height: check.height, sizes: image.sizes ?? [], ms });
  return { status: 201, body: { image, url: store.imageUrl(key), id } };
}

function errorText(err: unknown): string {
  return (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).slice(0, 500);
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

// A browser reports at most 20 failures per 10 minutes (one editor, a few retries).
export const clientLogLimiter: RateLimiter = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });

const ClientFailure = z.object({
  id: z.string().regex(UPLOAD_ID_PATTERN),
  step: z.enum(["prepare", "send", "sizes", "server"]),
  message: z.string().max(500),
  error: z.string().max(200).optional(),
  status: z.number().int().optional(),
  fileType: z.string().max(100).optional(),
  fileBytes: z.number().int().nonnegative().optional(),
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
  ms: z.number().nonnegative().optional(),
});

/**
 * A failure the server never saw (preparing on the device, or the connection dropping while
 * sending), reported by the browser. Logged and kept like server-side failures.
 */
export async function handleClientLog(store: ContentStore, raw: unknown, headers: Headers, limiter = clientLogLimiter): Promise<HandlerResult> {
  if (!limiter.hit(clientIp(headers)).allowed) return { status: 429, body: { error: "rate-limited" } };
  const parsed = ClientFailure.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "invalid" } };
  const record = {
    at: new Date().toISOString(),
    source: "browser",
    userAgent: (headers.get("user-agent") ?? "").slice(0, 300),
    ...parsed.data,
  };
  logEvent("upload", { ok: false, ...record });
  await store.putUploadFailure(record).catch((err) => console.error("Could not keep the upload failure record", err));
  return { status: 204, body: null };
}
