// Public-site access to the content store. Server components only: getStore() reads
// the bucket (or ./.data locally). Every admin save revalidates these pages.
import { cache } from "react";
import { getStore } from "@/lib/store";
import { logEvent } from "@/lib/log";
import type { Content, ImageRef } from "@/lib/content/schema";
import { sizeKey, srcSetFor } from "@/lib/images/sizes";

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

/** Where pictures with pre-made sizes are served from (the Cloudflare Worker). Unset: the old way. */
export function imageCdnUrl(): string | undefined {
  return process.env.ROWENNKALMAN_IMAGE_CDN_URL?.trim().replace(/\/$/, "") || undefined;
}

/**
 * src (+ srcSet) for a picture: its pre-made sizes through the Worker when it has them and the
 * switch is on, otherwise the original, which the page resizes through Netlify. See docs/IMAGES.md.
 */
export function pictureSrc(image: ImageRef): { src: string; srcSet?: string } {
  const cdn = imageCdnUrl();
  const srcSet = cdn ? srcSetFor(cdn, image) : undefined;
  if (!cdn || !srcSet || !image.sizes?.length) return { src: imageUrl(image.key) };
  return { src: `${cdn}/${sizeKey(image.key, image.sizes[0]!)}`, srcSet };
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
