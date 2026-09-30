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
        <nav aria-label="Main">
          <NavLinks items={items} />
        </nav>
      </details>
      <nav aria-label="Main" className="nav-wide">
        <NavLinks items={items} />
      </nav>
    </header>
  );
}
