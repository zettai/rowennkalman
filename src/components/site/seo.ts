// Search-engine helpers: page descriptions and schema.org structured data (JSON-LD).
// Everything here is derived from the site's own content; nothing is invented.
import type { Content, ImageRef } from "@/lib/content/schema";
import { paragraphs } from "@/lib/content/schema";
import { trimEndChars } from "@/lib/text";

/** The start of the text (as many paragraphs as fit), cut on a word boundary to fit a search snippet. */
export function excerpt(text: string, max = 155): string {
  const all = paragraphs(text).map((p) => p.replace(/\s+/g, " ").trim()).join(" ");
  if (all.length <= max) return all;
  const cut = all.slice(0, max - 1);
  const words = cut.lastIndexOf(" ") > 60 ? cut.slice(0, cut.lastIndexOf(" ")) : cut;
  return trimEndChars(words, ",;:. \t\n") + "…";
}

/** The page's own search description, or the start of its text, or the site's description. */
export function pageDescription(own: string | undefined, text: string, site: Content["site"]): string {
  return own?.trim() || excerpt(text) || site.metaDescription;
}

type Json = Record<string, unknown>;

/**
 * The full link-preview (Open Graph) block for a page. Next.js replaces a parent's openGraph
 * instead of merging it, so every page must carry the site name, type and the painting image.
 */
export function openGraphFor(
  content: Content,
  imageUrl: (key: string) => string,
  page: { title?: string; description?: string; url?: string } = {},
) {
  const hero = content.home.heroImage;
  return {
    siteName: content.site.name,
    type: "website" as const,
    title: page.title,
    description: page.description,
    url: page.url,
    images: hero ? [{ url: imageUrl(hero.key), width: hero.width, height: hero.height, alt: hero.alt }] : undefined,
  };
}

export function personId(base: URL): string {
  return new URL("/#person", base).toString();
}

/** A factual description of the collection when the portfolio has no intro text of its own. */
export function portfolioSummary(content: Content): string {
  const { artworks } = content.portfolio;
  const titles = artworks.map((a) => a.title.trim()).filter(Boolean).slice(0, 3);
  const base = `${artworks.length} paintings by ${content.site.name}`;
  return titles.length ? `${base}, including ${titles.join(", ")}.` : `${base}. ${content.site.metaDescription}`.trim();
}

/** Rowenn as a Person: name, what she does (the line under her name), her follow link. */
export function personJsonLd(content: Content, base: URL, imageUrl: (key: string) => string): Json {
  const { site, home } = content;
  return {
    "@type": "Person",
    "@id": personId(base),
    name: site.name,
    url: new URL("/", base).toString(),
    jobTitle: home.heroSubtitle || undefined,
    description: site.metaDescription || undefined,
    image: home.heroImage ? imageUrl(home.heroImage.key) : undefined,
    sameAs: site.footer.followUrl ? [site.footer.followUrl] : undefined,
  };
}

export function websiteJsonLd(content: Content, base: URL): Json {
  return {
    "@type": "WebSite",
    "@id": new URL("/#website", base).toString(),
    name: content.site.name,
    url: new URL("/", base).toString(),
    inLanguage: "en",
    publisher: { "@id": personId(base) },
  };
}

function imageObject(ref: ImageRef, url: string, content: Content, base: URL): Json {
  return {
    "@type": "ImageObject",
    contentUrl: url,
    width: ref.width,
    height: ref.height,
    caption: ref.alt || undefined,
    creator: { "@id": personId(base) },
    creditText: content.site.name,
    copyrightNotice: `© ${content.site.name}`,
  };
}

/** Each painting as a VisualArtwork: only the fields she has filled in are included. */
export function artworksJsonLd(content: Content, base: URL, imageUrl: (key: string) => string): Json {
  const works = content.portfolio.artworks.map((a) => ({
    "@type": "VisualArtwork",
    name: a.title || undefined,
    description: a.description || a.image.alt || undefined,
    artMedium: a.medium || undefined,
    dateCreated: /^\d{4}$/.test(a.year.trim()) ? a.year.trim() : undefined,
    size: a.size || undefined,
    image: imageObject(a.image, imageUrl(a.image.key), content, base),
    creator: { "@id": personId(base) },
    url: new URL("/portfolio", base).toString(),
  }));
  return {
    "@type": "CollectionPage",
    name: content.portfolio.title,
    url: new URL("/portfolio", base).toString(),
    mainEntity: { "@type": "ItemList", itemListElement: works.map((item, i) => ({ "@type": "ListItem", position: i + 1, item })) },
  };
}

/** The thesis documents on the Research page. */
export function researchJsonLd(content: Content, base: URL): Json {
  return {
    "@type": "WebPage",
    name: content.research.title,
    url: new URL("/research", base).toString(),
    inLanguage: ["en", "es"],
    hasPart: content.research.documents.map((d) => ({
      "@type": "DigitalDocument",
      name: d.labelEn,
      alternateName: d.labelEs || undefined,
      url: new URL(d.href, base).toString(),
      encodingFormat: d.href.toLowerCase().endsWith(".pdf") ? "application/pdf" : undefined,
      author: { "@id": personId(base) },
    })),
  };
}

/** One JSON-LD document; "undefined" fields are dropped by JSON.stringify. */
export function jsonLdGraph(nodes: Json[]): string {
  // Escape "<" so the text can never close the <script> tag it sits in.
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replaceAll("<", String.raw`\u003c`);
}
