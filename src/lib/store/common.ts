import { ContentSchema, IMAGE_KEY_PATTERN, type Content } from "@/lib/content/schema";
import seedJson from "@content/seed.json";
import { ConflictError, StoreError } from "./types";
import { SIZE_KEY_PATTERN, SIZE_WIDTHS, sizeKey } from "@/lib/images/sizes";

export function parseContent(raw: unknown, where: string): Content {
  const result = ContentSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ");
    throw new StoreError(`Invalid content ${where}: ${problems}`);
  }
  return result.data;
}

export function seedContent(): Content {
  return parseContent(structuredClone(seedJson), "in content/seed.json");
}

export function assertImageKey(key: string): void {
  if (!IMAGE_KEY_PATTERN.test(key)) throw new StoreError(`Refusing unexpected image key: ${JSON.stringify(key)}`);
}

export function assertSizeKey(key: string): void {
  if (!SIZE_KEY_PATTERN.test(key)) throw new StoreError(`Refusing unexpected image size key: ${JSON.stringify(key)}`);
}

/** Every size key a picture could have, for deleting them with it. */
export function allSizeKeys(originalKey: string): string[] {
  return SIZE_WIDTHS.map((w) => sizeKey(originalKey, w));
}

/** logs/upload-failures/<time>-<id>.json, sortable by time. */
export function uploadFailureKey(record: { at: string; id: string }): string {
  const safeId = record.id.replace(/[^A-Za-z0-9-]/g, "").slice(0, 32) || "unknown";
  return `logs/upload-failures/${record.at.replace(/[:.]/g, "-")}-${safeId}.json`;
}

/** A fresh updatedAt that is strictly later than the previous one (tokens must change on every write). */
export function nextUpdatedAt(previous: string, now: () => number = Date.now): string {
  const prev = Date.parse(previous);
  const t = Math.max(now(), Number.isFinite(prev) ? prev + 1 : 0);
  return new Date(t).toISOString();
}

/** The shared optimistic-concurrency step: validate, compare tokens, stamp. */
export function prepareWrite(current: Content, next: Content, expectedUpdatedAt: string, now?: () => number): Content {
  if (current.updatedAt !== expectedUpdatedAt) throw new ConflictError(current.updatedAt);
  const validated = parseContent(next, "to save");
  return { ...validated, updatedAt: nextUpdatedAt(current.updatedAt, now) };
}

/** Serialises async work within one process (read-compare-write must not interleave). */
export function createMutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    const result = tail.then(fn, fn);
    tail = result.catch(() => undefined);
    return result;
  };
}
