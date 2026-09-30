"use client";

import { useEffect, useState } from "react";

export type LiveState = "checking" | "live" | "slow";

const VERSION_TAG = /<meta name="content-version" content="([^"]+)"/;

/**
 * After a save, loads the public page until it shows the saved version (its content-version
 * tag), so the admin only says "live" when a visitor would really see the change.
 */
export function useLiveCheck(publicPath: string, version: string | undefined, timeoutMs = 20_000): LiveState | null {
  const [state, setState] = useState<LiveState | null>(null);
  useEffect(() => {
    if (!version) {
      setState(null);
      return;
    }
    let stopped = false;
    setState("checking");
    const deadline = Date.now() + timeoutMs;
    (async () => {
      while (!stopped && Date.now() < deadline) {
        try {
          const res = await fetch(publicPath, { cache: "no-store", headers: { accept: "text/html" } });
          const html = typeof res.text === "function" ? await res.text() : "";
          const shown = VERSION_TAG.exec(html)?.[1];
          if (shown && shown >= version) {
            if (!stopped) setState("live");
            console.info(JSON.stringify({ event: "live-check", path: publicPath, version, shown, result: "live" }));
            return;
          }
        } catch {
          // keep trying until the deadline
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!stopped) {
        setState("slow");
        console.warn(JSON.stringify({ event: "live-check", path: publicPath, version, result: "slow" }));
      }
    })();
    return () => {
      stopped = true;
    };
  }, [publicPath, version, timeoutMs]);
  return state;
}
