import type { Metadata } from "next";
import Link from "next/link";
import { getSiteContent } from "@/components/site/content";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import "@/styles/globals.css";

export const metadata: Metadata = { title: "Page not found | Rowenn Beth Kalman", robots: { index: false } };

// Root-level so every unknown address gets it; it brings the site's own header, footer and styles.
export default async function NotFound() {
  const { site } = await getSiteContent();
  return (
    <>
      <Header site={site} />
      <main id="main">
        <section className="page not-found">
          <h1 className="display">Page not found</h1>
          <p>
            There is nothing at this address. <Link href="/">Go to the home page</Link> or{" "}
            <Link href="/portfolio">see the paintings</Link>.
          </p>
        </section>
      </main>
      <Footer site={site} />
    </>
  );
}
