import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSiteContent, imageUrl, siteUrl } from "@/components/site/content";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import "@/styles/globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { site, home } = await getSiteContent();
  const hero = home.heroImage;
  return {
    metadataBase: siteUrl(),
    title: { default: site.metaTitle, template: `%s | ${site.name}` },
    description: site.metaDescription,
    // Link previews (messages, social posts) show the painting beside her name.
    openGraph: {
      siteName: site.name,
      type: "website",
      images: hero ? [{ url: imageUrl(hero.key), width: hero.width, height: hero.height, alt: hero.alt }] : undefined,
    },
    twitter: { card: hero ? "summary_large_image" : "summary" },
  };
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const { site } = await getSiteContent();
  return (
    <>
      <noscript>
        <style>{".fi img{opacity:1!important}"}</style>
      </noscript>
      <a className="skip" href="#main">Skip to content</a>
      <Header site={site} />
      <main id="main">{children}</main>
      <Footer site={site} />
    </>
  );
}
