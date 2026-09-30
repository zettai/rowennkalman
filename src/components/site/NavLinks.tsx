"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: Readonly<{ items: { href: string; label: string }[] }>) {
  const path = usePathname();
  return (
    <ul>
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            // The pages render per request, so Next only preloads them when asked. Without this
            // every menu click waited on a server round trip before the page changed.
            prefetch
            aria-current={path === item.href ? "page" : undefined}
            // On phones the links sit in a <details> menu, which page changes don't reset: close it.
            onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
