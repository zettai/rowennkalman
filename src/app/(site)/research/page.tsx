import type { Metadata } from "next";
import Image from "next/image";
import { getSiteContent, imageUrl, paragraphs, type Content } from "@/components/site/content";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getSiteContent();
  return { title: site.nav.research };
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
  const { research } = await getSiteContent();
  return (
    <section className="page research">
      <h1 className="display page-title">{research.title}</h1>
      <div className="research-grid">
        {research.image && (
          <div className="research-image">
            <Image
              src={imageUrl(research.image.key)}
              alt={research.image.alt}
              width={research.image.width}
              height={research.image.height}
              sizes="(max-width: 767px) 100vw, 30vw"
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
