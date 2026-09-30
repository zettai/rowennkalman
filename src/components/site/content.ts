// Public-site view of the content contract (requests/rowennkalman-admin.md in claude-cloud).
// Temporary: at integration this reads from the cloud agent's getStore() and its Content type.
import devContent from "./dev-content.json";

export type ImageRef = { key: string; width: number; height: number; alt: string };

export type Artwork = {
  id: string;
  image: ImageRef;
  title: string;
  medium: string;
  size: string;
  year: string;
  description: string;
};

export type Content = typeof devContent & {
  home: { heroImage: ImageRef | null; featured: string[] };
  contact: { image: ImageRef | null };
  research: { image: ImageRef | null };
  portfolio: { artworks: Artwork[] };
};

export async function getSiteContent(): Promise<Content> {
  return devContent as Content;
}

// "art/<file>" -> URL. Dev serves the originals from public/_dev-art (a symlink to assets/).
export function imageUrl(key: string): string {
  const file = key.replace(/^art\//, "");
  return `/_dev-art/${encodeURIComponent(file)}`;
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// One list for the header and the footer, so the two never drift apart.
export function navItems(site: Content["site"]): { href: string; label: string }[] {
  return [
    { href: "/", label: site.nav.home },
    { href: "/about", label: site.nav.about },
    { href: "/portfolio", label: site.nav.portfolio },
    { href: "/research", label: site.nav.research },
    { href: "/contact", label: site.nav.contact },
  ];
}
