import type { Metadata } from "next";
import { getSiteContent, imageUrl, paragraphs } from "@/components/site/content";
import { ContactForm } from "@/components/site/ContactForm";
import { Painting } from "@/components/site/Painting";
import { pageDescription } from "@/components/site/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const description = pageDescription(content.contact.seoDescription, content.contact.intro, content.site);
  return {
    title: content.site.nav.contact,
    description,
    alternates: { canonical: "/contact" },
    openGraph: { title: `${content.site.nav.contact} | ${content.site.name}`, description, url: "/contact" },
  };
}

export default async function ContactPage() {
  const { contact } = await getSiteContent();
  return (
    <section className="page contact">
      <div className="contact-text">
        <h1 className="display">{contact.title}</h1>
        <div className="prose">
          {paragraphs(contact.intro).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <ContactForm labels={contact.form} />
      </div>
      {contact.image && (
        <div className="feature-image">
          <Painting
            image={contact.image}
            src={imageUrl(contact.image.key)}
            sizes="(max-width: 767px) 100vw, 34vw"
            layout="fill"
            priority
          />
        </div>
      )}
    </section>
  );
}
