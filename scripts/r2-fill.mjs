#!/usr/bin/env node
/**
 * Warms rowennkalman-art by requesting every picture URL listed on the public site pages.
 * Usage: node scripts/r2-fill.mjs [baseUrl]
 */
const SITE = (process.argv[2] ?? "https://rowennkalman.com").replace(/\/$/, "");
const PAGES = ["", "/about", "/contact", "/portfolio", "/research"];
const IMG = "https://img.rowennkalman.com/art/";
const CONCURRENCY = 6;

const srcRe = /\bsrc=["'](https:\/\/img\.rowennkalman\.com\/art\/[^"']+)["']/gi;
const srcsetRe = /\bsrcset=["']([^"']+)["']/gi;

function urlsFromHtml(html) {
  const out = new Set();
  for (const re of [srcRe, srcsetRe]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(html)) !== null) {
      const chunk = m[1];
      if (chunk.startsWith(IMG)) out.add(chunk);
      else {
        for (const part of chunk.split(",")) {
          const url = part.trim().split(/\s+/)[0];
          if (url?.startsWith(IMG)) out.add(url);
        }
      }
    }
  }
  return [...out];
}

async function fetchText(path) {
  const res = await fetch(`${SITE}${path}`);
  if (!res.ok) throw new Error(`${SITE}${path} returned ${res.status}`);
  return res.text();
}

async function warmUrl(url) {
  const res = await fetch(url);
  if (res.body) await res.arrayBuffer();
  const cache = res.headers.get("X-Image-Cache") ?? (res.ok ? "none" : `http-${res.status}`);
  return { url, status: res.status, cache };
}

async function main() {
  const htmls = await Promise.all(PAGES.map((p) => fetchText(p)));
  const urls = [...new Set(htmls.flatMap(urlsFromHtml))].sort();
  if (!urls.length) {
    console.log("No picture URLs found.");
    return;
  }

  const results = [];
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map(warmUrl))));
  }

  const byCache = {};
  const bad = [];
  for (const r of results) {
    byCache[r.cache] = (byCache[r.cache] ?? 0) + 1;
    if (r.status !== 200) bad.push(r);
  }

  console.log(`Pictures requested: ${results.length}`);
  console.log("X-Image-Cache:", byCache);
  if (bad.length) {
    console.error("Non-200 responses:");
    for (const r of bad) console.error(`  ${r.status} ${r.url}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
