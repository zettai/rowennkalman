/**
 * Adds missing pre-made sizes to pictures already in the content (see docs/IMAGES.md and
 * scripts/image-sizes.mts). Framework-free so it can be tested with MemoryStore.
 */
import { ConflictError, type ContentStore } from "@/lib/store";
import { IMAGE_KEY_PATTERN, type Content, type ImageRef } from "@/lib/content/schema";
import { makeSizes, sizeKey, widthsFor } from "./sizes";

/** Every picture in the content, once per key. */
export function imagesIn(content: Content): ImageRef[] {
  const found = new Map<string, ImageRef>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.key === "string" && IMAGE_KEY_PATTERN.test(o.key) && typeof o.width === "number") {
      if (!found.has(o.key)) found.set(o.key, o as unknown as ImageRef);
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(content);
  return [...found.values()];
}

/** The content with `sizes` set on every reference to the given pictures. */
export function withSizes(content: Content, sizes: ReadonlyMap<string, number[]>): Content {
  const map = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(map);
    if (!v || typeof v !== "object") return v;
    const o = v as Record<string, unknown>;
    if (typeof o.key === "string" && sizes.has(o.key) && typeof o.width === "number") {
      const widths = sizes.get(o.key)!;
      const rest = { ...o };
      delete rest.sizes;
      return widths.length ? { ...rest, sizes: widths } : rest;
    }
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, map(x)]));
  };
  return map(content) as Content;
}

export type BackfillItem = { key: string; width: number; have: number[]; want: number[] };
export type BackfillReport = { planned: BackfillItem[]; made: string[]; skipped: number; savedUpdatedAt?: string };

export async function backfillSizes(
  store: ContentStore,
  options: {
    apply: boolean;
    force?: boolean;
    fetchOriginal: (key: string) => Promise<Uint8Array>;
    make?: typeof makeSizes;
    log?: (line: string) => void;
    beforeSave?: (current: Content) => Promise<void>;
  },
): Promise<BackfillReport> {
  const log = options.log ?? (() => undefined);
  const content = await store.getContent();
  const planned: BackfillItem[] = [];
  let skipped = 0;
  for (const img of imagesIn(content)) {
    const want = widthsFor(img.width);
    const have = img.sizes ?? [];
    if (!options.force && have.join() === want.join()) {
      skipped++;
      continue;
    }
    planned.push({ key: img.key, width: img.width, have, want });
  }
  const report: BackfillReport = { planned, made: [], skipped };
  if (!options.apply || planned.length === 0) return report;

  const results = new Map<string, number[]>();
  for (const item of planned) {
    const original = await options.fetchOriginal(item.key);
    const made = await (options.make ?? makeSizes)(original, item.width);
    for (const size of made) {
      const key = sizeKey(item.key, size.width);
      await store.putImageSize(key, size.bytes);
      report.made.push(key);
    }
    results.set(item.key, made.map((s) => s.width));
    log(`  ${item.key}: ${made.map((s) => `${s.width}w ${Math.round(s.bytes.length / 1024)}KB`).join(", ")}`);
  }

  // Record the sizes with a versioned save; if an editor saved meanwhile, re-read and retry.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const current = await store.getContent();
    await options.beforeSave?.(current);
    try {
      const saved = await store.putContent(withSizes(current, results), current.updatedAt);
      report.savedUpdatedAt = saved.updatedAt;
      return report;
    } catch (err) {
      if (!(err instanceof ConflictError) || attempt === 3) throw err;
      log(`  content changed while working (attempt ${attempt}); re-reading and retrying`);
    }
  }
  return report;
}
