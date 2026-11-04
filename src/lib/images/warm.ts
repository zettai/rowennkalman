import { logEvent } from "@/lib/log";
import { sizeKey } from "@/lib/images/sizes";
import type { ImageRef } from "@/lib/content/schema";

const CONCURRENCY = 5;
const TIMEOUT_MS = 8000;

/** Requests each CDN URL for a newly uploaded picture so R2 and the edge cache warm up. Never throws. */
export async function warmPictureCdn(image: ImageRef): Promise<void> {
  const base = process.env.ROWENNKALMAN_IMAGE_CDN_URL?.replace(/\/$/, "");
  if (!base || !image.sizes?.length) return;

  const keys = [...image.sizes.map((w) => sizeKey(image.key, w)), image.key];
  const urls = keys.map((k) => `${base}/${k}`);
  const counts: Record<string, number> = {};
  const started = Date.now();

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
          const label = res.headers.get("X-Image-Cache") ?? (res.ok ? "none" : `http-${res.status}`);
          counts[label] = (counts[label] ?? 0) + 1;
        } catch {
          counts.error = (counts.error ?? 0) + 1;
        }
      }),
    );
  }

  logEvent("warm", { key: image.key, ...counts, ms: Date.now() - started });
}
