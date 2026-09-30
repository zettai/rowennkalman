import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSiteContent, imageUrl, siteUrl } from "@/components/site/content";
import { jsonLdGraph, openGraphFor, personJsonLd, websiteJsonLd } from "@/components/site/seo";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { CountPageViews } from "@/components/site/CountPageViews";
import { trackerUrl } from "@/lib/stats/goatcounter";
import "@/styles/globals.css";

// Always render from the latest content: Netlify's cached copies could show an old version
// for the first visit after a save (stale-while-revalidate). See docs/AUDIT.md.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const { site, home } = content;
  const hero = home.heroImage;
  return {
    metadataBase: siteUrl(),
    title: { default: site.metaTitle, template: `%s | ${site.name}` },
    description: site.metaDescription,
    // Link previews (messages, social posts) show the painting beside her name.
    openGraph: openGraphFor(content, imageUrl),
    twitter: { card: hero ? "summary_large_image" : "summary" },
    // Which save this page shows: compare with the admin's save time when debugging.
    other: { "content-version": content.updatedAt },
  };
}

export default async function SiteLayout({ children }: Readonly<{ children: ReactNode }>) {
  const content = await getSiteContent();
  const { site } = content;
  const base = siteUrl();
  const tracker = trackerUrl();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdGraph([websiteJsonLd(content, base), personJsonLd(content, base, imageUrl)]) }}
      />
      <noscript>
        <style>{".fi img{opacity:1!important}"}</style>
      </noscript>
      <a className="skip" href="#main">Skip to content</a>
      <Header site={site} />
      <main id="main">{children}</main>
      <Footer site={site} />
      {/* Visit counter (self-hosted GoatCounter): no cookies; off when the variable is unset. */}
      {tracker && <script async data-goatcounter={`${tracker}/count`} src={`${tracker}/count.js`} />}
      {tracker && <CountPageViews />}
    </>
  );
}
