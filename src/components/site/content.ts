// Public-site access to the content store. Server components only: getStore() reads
// the bucket (or ./.data locally). Every admin save revalidates these pages.
import { cache } from "react";
import { getStore } from "@/lib/store";
import { logEvent } from "@/lib/log";
import type { Content } from "@/lib/content/schema";

export type { Artwork, Content, ImageRef } from "@/lib/content/schema";
export { paragraphs } from "@/lib/content/schema";

/** The site's public address: set explicitly, else Netlify's URL, else the domain. */
export function siteUrl(): URL {
  return new URL(process.env.ROWENNKALMAN_SITE_URL?.trim() || process.env.URL?.trim() || "https://rowennkalman.com");
}

/**
 * The latest content, read once per request (layout, page and metadata share it).
 * Pages are rendered on every request (no pre-built copies), so a save shows on the next load.
 */
export const getSiteContent = cache(async (): Promise<Content> => {
  const started = Date.now();
  const content = await getStore().getContent();
  logEvent("render", { version: content.updatedAt, ms: Date.now() - started });
  return content;
});

export function imageUrl(key: string): string {
  return getStore().imageUrl(key);
}

// One list for the header and the footer, so the two never drift apart.
export function navItems(site: Content["site"]): { href: string; label: string }[] {
  return [
    { href: "/", label: site.nav.home },
    { href: "/about", label: site.nav.about },
    { href: "/portfolio", label: site.nav.portfolio },
    { href: "/research", label: site.nav.research },
    { href: "/contact", label: site.nav.contact },
  ];
}
