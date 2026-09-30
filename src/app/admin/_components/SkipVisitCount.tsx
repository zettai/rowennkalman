"use client";
import { useEffect } from "react";

/**
 * Marks this browser so GoatCounter's count.js stops counting its visits to the public site
 * (count.js checks localStorage "skipgc"). The admin and the site share an origin, so opening
 * the editor once is enough.
 */
export function SkipVisitCount() {
  useEffect(() => {
    try {
      localStorage.setItem("skipgc", "t");
    } catch {
      // Storage blocked (private window): the editor's own visits are counted. Harmless.
    }
  }, []);
  return null;
}
