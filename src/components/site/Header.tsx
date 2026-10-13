import Link from "next/link";
import { navItems, type Content } from "./content";
import { NavLinks } from "./NavLinks";

export function Header({ site }: Readonly<{ site: Content["site"] }>) {
  const items = navItems(site);
  return (
    <header className="site-header">
      <Link href="/" className="site-title">
        {site.name}
      </Link>
      <details className="menu">
        <summary aria-label="Menu">Menu</summary>
        {/* Separate accessible name from the wide nav so landmarks stay unique when open. */}
        <nav aria-label="Mobile">
          <NavLinks items={items} />
        </nav>
      </details>
      <nav aria-label="Main" className="nav-wide">
        <NavLinks items={items} />
      </nav>
    </header>
  );
}
