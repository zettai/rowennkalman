import type { Metadata } from "next";
import { getSiteContent, imageUrl, paragraphs, siteUrl, type Content } from "@/components/site/content";
import { Painting } from "@/components/site/Painting";
import { jsonLdGraph, pageDescription, researchJsonLd } from "@/components/site/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const description = pageDescription(content.research.seoDescription, content.research.introEn, content.site);
  return {
    title: content.site.nav.research,
    description,
    alternates: { canonical: "/research" },
    openGraph: { title: `${content.site.nav.research} | ${content.site.name}`, description, url: "/research" },
  };
}

function Intro({ research, lang }: { research: Content["research"]; lang: "en" | "es" }) {
  const text = lang === "en" ? research.introEn : research.introEs;
  return (
    <div className="prose research-intro" lang={lang}>
      {paragraphs(text).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <ul className="documents">
        {research.documents.map((d) => (
          <li key={d.id}>
            <a href={d.href}>{lang === "en" ? d.labelEn : d.labelEs}</a>{" "}
            <span className="doc-type">(PDF)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ResearchPage() {
  const content = await getSiteContent();
  const { research } = content;
  return (
    <section className="page research">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdGraph([researchJsonLd(content, siteUrl())]) }} />
      <h1 className="display page-title">{research.title}</h1>
      <div className="research-grid">
        {research.image && (
          <div className="research-image">
            <Painting
              image={research.image}
              src={imageUrl(research.image.key)}
              sizes="(max-width: 767px) 100vw, 30vw"
              eager
            />
          </div>
        )}
        <div className="research-text">
          <Intro research={research} lang="en" />
          <Intro research={research} lang="es" />
        </div>
      </div>
    </section>
  );
}
