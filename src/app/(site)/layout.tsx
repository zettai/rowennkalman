import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSiteContent } from "@/components/site/content";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getSiteContent();
  return {
    title: { default: site.metaTitle, template: `%s | ${site.name}` },
    description: site.metaDescription,
    openGraph: { siteName: site.name, type: "website" },
  };
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const { site } = await getSiteContent();
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Header site={site} />
      <main id="main">{children}</main>
      <Footer site={site} />
    </>
  );
}
