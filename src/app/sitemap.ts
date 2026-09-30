import type { MetadataRoute } from "next";
import { getSiteContent, siteUrl } from "@/components/site/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { updatedAt, research } = await getSiteContent();
  const base = siteUrl();
  const pages = ["/", "/about", "/portfolio", "/research", "/contact"].map((p) => ({
    url: new URL(p, base).toString(),
    lastModified: updatedAt,
  }));
  // The thesis PDFs are the pages people already cite; keep them findable.
  const docs = research.documents
    .filter((d) => d.href.startsWith("/"))
    .map((d) => ({ url: new URL(d.href, base).toString() }));
  return [...pages, ...docs];
}
