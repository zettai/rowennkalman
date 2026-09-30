import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getSiteContent, imageUrl } from "@/components/site/content";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const { home, portfolio } = await getSiteContent();
  const featured = home.featured
    .map((id) => portfolio.artworks.find((a) => a.id === id))
    .filter((a) => a !== undefined);

  return (
    <>
      <section className="home-hero">
        <div className="home-hero-text">
          <h1 className="display" data-testid="hero-title">
            {home.heroTitle}
          </h1>
          <p>{home.heroSubtitle}</p>
        </div>
        {home.heroImage && (
          <div className="feature-image">
            <Image
              src={imageUrl(home.heroImage.key)}
              alt={home.heroImage.alt}
              fill
              priority
              sizes="(max-width: 767px) 100vw, 34vw"
            />
          </div>
        )}
      </section>

      {featured.length > 0 && (
        <section className="home-works" aria-label="Selected paintings">
          <ul>
            {featured.map((a) => (
              <li key={a.id}>
                <Link href="/portfolio">
                  <Image
                    src={imageUrl(a.image.key)}
                    alt={a.image.alt}
                    width={a.image.width}
                    height={a.image.height}
                    sizes="(max-width: 767px) 100vw, 30vw"
                  />
                </Link>
                {a.title && <p className="artwork-title">{a.title}</p>}
              </li>
            ))}
          </ul>
          <p>
            <Link href="/portfolio">{home.portfolioLinkLabel}</Link>
          </p>
        </section>
      )}
    </>
  );
}
