import type { Metadata } from "next";
import type { ReactNode } from "react";
import s from "./admin.module.css";

export const metadata: Metadata = {
  title: "Site editor",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={s.root}>{children}</div>;
}
