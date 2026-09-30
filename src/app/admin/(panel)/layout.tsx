import Link from "next/link";
import type { ReactNode } from "react";
import s from "../admin.module.css";
import { requireSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return (
    <>
      <a href="#main" className={s.skip}>
        Skip to content
      </a>
      <header className={s.header}>
        <div className={s.headerInner}>
          <Link href="/admin" className={s.brand}>
            Site editor
          </Link>
          <nav className={s.headerLinks} aria-label="Editor">
            <a href="/" target="_blank" rel="noreferrer" className={s.buttonQuiet}>
              View site ↗
            </a>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className={s.buttonQuiet}>
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main id="main" className={s.main}>
        {children}
      </main>
    </>
  );
}
