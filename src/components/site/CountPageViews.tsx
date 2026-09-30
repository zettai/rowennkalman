"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type GoatCounter = { count?: (vars: { path: string }) => void };

/**
 * GoatCounter's count.js counts only full page loads. Menu links here are client-side
 * navigations, so without this every page after the landing page went uncounted (2026-09-30).
 * The first page is left to count.js; this reports each later path change.
 */
export function CountPageViews() {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    (window as unknown as { goatcounter?: GoatCounter }).goatcounter?.count?.({ path });
  }, [path]);
  return null;
}
