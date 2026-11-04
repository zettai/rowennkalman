import path from "node:path";
import type { NextConfig } from "next";
import { PAGE_CACHE_TAG, PAGE_CDN_SECONDS, PUBLIC_PAGE_PATHS } from "./src/lib/page-cache";

// Public host of the bucket's images (ROWENNKALMAN_PUBLIC_IMAGE_BASE), allowed for next/image.
// On Netlify, next/image goes through the Netlify Image CDN, which resizes per request.
const imageBase = process.env.ROWENNKALMAN_PUBLIC_IMAGE_BASE?.trim();
const remotePatterns = imageBase ? [new URL(`${imageBase.replace(/\/$/, "")}/**`)] : [];

const nextConfig: NextConfig = {
  images: { remotePatterns },
  poweredByHeader: false,
  // Pages render per request, so by default the browser throws a page away as soon as you leave
  // it and going back waits on the server again (~1 s). Keep visited pages for a few minutes, like
  // the menu's prefetched ones. After an admin save, an open tab can show the old version for up
  // to that long; a reload always shows the latest.
  experimental: { staleTimes: { dynamic: 300 } },
  outputFileTracingRoot: path.resolve("."),
  // FileStore seeds .data/ from these on first read; ship them with the server bundle.
  outputFileTracingIncludes: { "/**": ["./content/**"] },
  async headers() {
    // Public pages: Netlify's CDN keeps each page until an admin save purges the tag (no
    // stale-while-revalidate). Long max-age is safe because every save purges rk-pages.
    const cdn = [
      { key: "Netlify-CDN-Cache-Control", value: `public, durable, s-maxage=${PAGE_CDN_SECONDS}` },
      { key: "Netlify-Cache-Tag", value: PAGE_CACHE_TAG },
    ];
    const pages = PUBLIC_PAGE_PATHS.map((source) => ({ source, headers: cdn }));
    // No script-src here: Next inlines its bootstrap scripts. These parts are safe without nonces.
    return [
      ...pages,
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    // The old thesis landing page. The PDFs under /tesis/*.pdf are served as-is from public/.
    // Next strips the trailing slash first (/tesis/ -> /tesis -> /research); on Netlify,
    // netlify.toml answers /tesis/ in one hop before the request reaches Next.
    return [
      { source: "/tesis", destination: "/research", permanent: true },
      { source: "/tesis/", destination: "/research", permanent: true },
      { source: "/tesis/index.html", destination: "/research", permanent: true },
    ];
  },
};

export default nextConfig;
