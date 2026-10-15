import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { NOT_FOUND_SITE } from "./not-found-site";
import "@/styles/globals.css";

export const metadata: Metadata = { title: "Page not found | Rowenn Beth Kalman", robots: { index: false } };

// Root-level so every unknown address gets it; it brings the site's own header, footer and styles.
// Admin edits to site chrome do not reach the 404 page (deliberate: it must build without the store).
export default function NotFound() {
  return (
    <>
      <Header site={NOT_FOUND_SITE} />
      <main id="main">
        <section className="page not-found">
          <h1 className="display">Page not found</h1>
          <p>
            There is nothing at this address. <Link href="/">Go to the home page</Link> or{" "}
            <Link href="/portfolio">see the paintings</Link>.
          </p>
        </section>
      </main>
      <Footer site={NOT_FOUND_SITE} />
    </>
  );
}
