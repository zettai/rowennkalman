import type { Metadata } from "next";
import { getSiteContent, imageUrl, paragraphs } from "@/components/site/content";
import { Gallery } from "@/components/site/Gallery";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getSiteContent();
  return { title: site.nav.portfolio };
}

export default async function PortfolioPage() {
  const { portfolio } = await getSiteContent();
  const items = portfolio.artworks.map((a) => ({ ...a, src: imageUrl(a.image.key) }));
  return (
    <section className="page portfolio">
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
