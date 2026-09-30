import Link from "next/link";
import { navItems, type Content } from "./content";

export function Footer({ site }: { site: Content["site"] }) {
  return (
    <footer className="site-footer">
      <p className="footer-title">{site.name}</p>
      <nav aria-label="Footer">
        <ul>
          {navItems(site).map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
          {site.footer.followUrl && (
            <li>
              <a href={site.footer.followUrl} target="_blank" rel="noopener noreferrer">
                {site.footer.followLabel}
              </a>
            </li>
          )}
        </ul>
      </nav>
    </footer>
  );
}
