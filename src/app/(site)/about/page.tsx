import type { Metadata } from "next";
import { Fragment } from "react";
import { getSiteContent, imageUrl, paragraphs } from "@/components/site/content";
import { Painting } from "@/components/site/Painting";
import { pageDescription } from "@/components/site/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const description = pageDescription(content.about.seoDescription, content.about.body, content.site);
  return {
    title: content.site.nav.about,
    description,
    alternates: { canonical: "/about" },
    openGraph: { title: `${content.site.nav.about} | ${content.site.name}`, description, url: "/about" },
  };
}

// Pictures go after these paragraphs (1-based), in order; extra pictures follow the text.
const AFTER_PARAGRAPH = [1, 3, 4];

export default async function AboutPage() {
  const { about } = await getSiteContent();
  const text = paragraphs(about.body);
  const slotted = about.images.slice(0, AFTER_PARAGRAPH.length);
  const rest = about.images.slice(AFTER_PARAGRAPH.length);

  const picture = (img: (typeof about.images)[number]) => (
    <figure className="about-figure" key={img.key}>
      <Painting image={img} src={imageUrl(img.key)} sizes="(max-width: 767px) 100vw, 56rem" />
    </figure>
  );

  return (
    <section className="page about">
      <h1 className="display page-title">{about.title}</h1>
      <div className="about-flow">
        {text.map((p, i) => {
          const slot = AFTER_PARAGRAPH.indexOf(i + 1);
          return (
            <Fragment key={i}>
              <p>{p}</p>
              {slot >= 0 && slotted[slot] && picture(slotted[slot])}
            </Fragment>
          );
        })}
        {rest.map(picture)}
      </div>
    </section>
  );
}
