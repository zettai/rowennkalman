import type { Metadata } from "next";
import Link from "next/link";
import { getSiteContent, imageUrl } from "@/components/site/content";
import { Painting } from "@/components/site/Painting";

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
            <Painting
              image={home.heroImage}
              src={imageUrl(home.heroImage.key)}
              sizes="(max-width: 767px) 100vw, 34vw"
              layout="fill"
              priority
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
                  <Painting image={a.image} src={imageUrl(a.image.key)} sizes="(max-width: 767px) 100vw, 30vw" eager />
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
