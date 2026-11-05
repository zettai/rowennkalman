#!/usr/bin/env node
// Warms Netlify's cached copies of the five public pages (two Accept-Encoding variants each).
// Keep paths and encodings in sync with src/lib/page-cache.ts.
//
//   node scripts/refresh-pages.mjs
//   node scripts/refresh-pages.mjs https://staging.example.com
const DEFAULT_BASE = "https://rowennkalman.com";
const PATHS = ["/", "/about", "/portfolio", "/research", "/contact"];
const ENCODINGS = ["gzip, deflate, br, zstd", "gzip, deflate, br"];
const USER_AGENT = "rowennkalman-page-refresh/1";

const base = new URL(process.argv[2]?.trim() || DEFAULT_BASE);
let failed = false;

for (const encoding of ENCODINGS) {
  for (const path of PATHS) {
    const url = new URL(path, base);
    const started = performance.now();
    let status = 0;
    let cacheStatus = "";
    try {
      const res = await fetch(url, {
        headers: { Accept: "text/html", "Accept-Encoding": encoding, "User-Agent": USER_AGENT },
        cache: "no-store",
      });
      status = res.status;
      cacheStatus = res.headers.get("cache-status") ?? res.headers.get("Cache-Status") ?? "";
      const ttfb = Math.round(performance.now() - started);
      await res.arrayBuffer();
      const totalMs = Math.round(performance.now() - started);
      console.log(`${path}\t${encoding}\t${status}\t${ttfb}ms\t${cacheStatus}\t${totalMs}ms`);
    } catch (err) {
      status = 0;
      cacheStatus = err instanceof Error ? err.message : "error";
      failed = true;
      const totalMs = Math.round(performance.now() - started);
      console.log(`${path}\t${encoding}\t${status}\t${totalMs}ms\t${cacheStatus}\t${totalMs}ms`);
    }
    if (status !== 200) failed = true;
  }
}

process.exit(failed ? 1 : 0);
