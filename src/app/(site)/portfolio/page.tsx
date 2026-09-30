import type { Metadata } from "next";
import { getSiteContent, imageUrl, paragraphs, siteUrl } from "@/components/site/content";
import { Gallery } from "@/components/site/Gallery";
import { artworksJsonLd, jsonLdGraph, pageDescription, portfolioSummary } from "@/components/site/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const description = pageDescription(content.portfolio.seoDescription, content.portfolio.intro || portfolioSummary(content), content.site);
  return {
    title: content.site.nav.portfolio,
    description,
    alternates: { canonical: "/portfolio" },
    openGraph: { title: `${content.site.nav.portfolio} | ${content.site.name}`, description, url: "/portfolio" },
  };
}

export default async function PortfolioPage() {
  const content = await getSiteContent();
  const { portfolio } = content;
  const items = portfolio.artworks.map((a) => ({ ...a, src: imageUrl(a.image.key) }));
  return (
    <section className="page portfolio">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdGraph([artworksJsonLd(content, siteUrl(), imageUrl)]) }}
      />
      <h1 className="visually-hidden">{portfolio.title}</h1>
      {portfolio.intro && (
        <div className="prose portfolio-intro">
          {paragraphs(portfolio.intro).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
      <Gallery items={items} />
    </section>
  );
}
