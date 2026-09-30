import type { MetadataRoute } from "next";
import { getSiteContent, imageUrl, siteUrl } from "@/components/site/content";
import type { ImageRef } from "@/lib/content/schema";

// Rebuilt on every request, like the pages, so it always lists the current paintings.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getSiteContent();
  const { updatedAt, home, about, portfolio, research, contact } = content;
  const base = siteUrl();
  const abs = (u: string) => new URL(u, base).toString();
  const imgs = (refs: (ImageRef | null | undefined)[]) =>
    [...new Set(refs.filter((r): r is ImageRef => Boolean(r)).map((r) => abs(imageUrl(r.key))))];
  const featured = home.featured.map((id) => portfolio.artworks.find((a) => a.id === id)?.image);
  const pages: [string, string[]][] = [
    ["/", imgs([home.heroImage, ...featured])],
    ["/about", imgs(about.images)],
    // The paintings are listed with images so Google Images can find each one.
    ["/portfolio", imgs(portfolio.artworks.map((a) => a.image))],
    ["/research", imgs([research.image])],
    ["/contact", imgs([contact.image])],
  ];
  const entries: MetadataRoute.Sitemap = pages.map(([p, images]) => ({ url: abs(p), lastModified: updatedAt, images }));
  // The thesis PDFs are the pages people already cite; keep them findable.
  for (const d of research.documents.filter((d) => d.href.startsWith("/"))) entries.push({ url: abs(d.href) });
  return entries;
}
