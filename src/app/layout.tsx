import type { ReactNode } from "react";
import { Syne, Syne_Mono } from "next/font/google";

const syne = Syne({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-display" });
const syneMono = Syne_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-body" });

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${syne.variable} ${syneMono.variable}`}>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
