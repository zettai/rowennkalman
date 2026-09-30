import type { Content } from "./schema";

/** The top-level parts of Content that the admin edits one screen at a time. */
export const PAGE_KEYS = ["site", "home", "about", "portfolio", "research", "contact"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export function isPageKey(value: unknown): value is PageKey {
  return typeof value === "string" && (PAGE_KEYS as readonly string[]).includes(value);
}

/** Every image key referenced by a Content document. */
export function collectImageKeys(content: Content): Set<string> {
  const keys = new Set<string>();
  if (content.home.heroImage) keys.add(content.home.heroImage.key);
  for (const img of content.about.images) keys.add(img.key);
  for (const art of content.portfolio.artworks) keys.add(art.image.key);
  if (content.contact.image) keys.add(content.contact.image.key);
  if (content.research.image) keys.add(content.research.image.key);
  return keys;
}

/** Split long text into paragraphs on blank lines (how about.body is rendered). */
export function paragraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
