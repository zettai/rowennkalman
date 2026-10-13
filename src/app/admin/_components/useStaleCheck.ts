"use client";

import { useEffect, useState } from "react";

/**
 * Tells the editor when the site's content changed somewhere else (another tab, another device)
 * since this page was loaded, before they start typing into an old copy. Checks when the tab
 * comes back into view and every minute while it is visible. Returns the newer version, or null.
 */
export function useStaleCheck(loadedVersion: string, intervalMs = 60_000): string | null {
  // Tied to loadedVersion so a save on this page clears the warning without a separate effect.
  const [stale, setStale] = useState<{ forVersion: string; newer: string } | null>(null);
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/admin/content", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { content?: { updatedAt?: string } };
        const current = body.content?.updatedAt;
        if (!stopped && current && current !== loadedVersion) {
          setStale({ forVersion: loadedVersion, newer: current });
        }
      } catch {
        // offline for a moment: try again on the next check
      }
    };
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    globalThis.addEventListener("focus", onVisible);
    const timer = globalThis.setInterval(check, intervalMs);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      globalThis.removeEventListener("focus", onVisible);
      globalThis.clearInterval(timer);
    };
  }, [loadedVersion, intervalMs]);
  return stale && stale.forVersion === loadedVersion ? stale.newer : null;
}
