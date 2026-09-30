import { purgeCache } from "@netlify/functions";

/** Cache tag on every public page (set in next.config.ts headers). */
export const PAGE_CACHE_TAG = "rk-pages";

/**
 * Drops Netlify's cached copies of the public pages so the next visit renders the new content.
 * Outside Netlify (local dev, tests) there is no CDN: returns "skipped". Never throws.
 */
export async function purgePublicPages(): Promise<"purged" | "skipped" | "failed"> {
  if (!process.env.NETLIFY && !process.env.NETLIFY_PURGE_API_TOKEN && !process.env.SITE_ID) return "skipped";
  try {
    await purgeCache({ tags: [PAGE_CACHE_TAG] });
    return "purged";
  } catch (err) {
    console.error("Page cache purge failed", err instanceof Error ? err.message : err);
    return "failed";
  }
}
