import Link from "next/link";
import { navItems, type Content } from "./content";
import { copyrightHolder } from "./seo";

export function Footer({ site }: Readonly<{ site: Content["site"] }>) {
  const holder = copyrightHolder(site);
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
      {holder && <p className="footer-copyright">© {new Date().getFullYear()} {holder}. All rights reserved.</p>}
    </footer>
  );
}
