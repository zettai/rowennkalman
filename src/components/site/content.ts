// Public-site access to the content store. Server components only: getStore() reads
// the bucket (or ./.data locally). Every admin save revalidates these pages.
import { getStore } from "@/lib/store";
import type { Content } from "@/lib/content/schema";

export type { Artwork, Content, ImageRef } from "@/lib/content/schema";
export { paragraphs } from "@/lib/content/schema";

/** The site's public address: set explicitly, else Netlify's URL, else the domain. */
export function siteUrl(): URL {
  return new URL(process.env.ROWENNKALMAN_SITE_URL?.trim() || process.env.URL?.trim() || "https://rowennkalman.com");
}

export async function getSiteContent(): Promise<Content> {
  return getStore().getContent();
}

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
