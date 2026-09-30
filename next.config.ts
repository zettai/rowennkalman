import path from "node:path";
import type { NextConfig } from "next";

// Public host of the bucket's images (ROWENNKALMAN_PUBLIC_IMAGE_BASE), allowed for next/image.
// On Netlify, next/image goes through the Netlify Image CDN, which resizes per request.
const imageBase = process.env.ROWENNKALMAN_PUBLIC_IMAGE_BASE?.trim();
const remotePatterns = imageBase ? [new URL(`${imageBase.replace(/\/$/, "")}/**`)] : [];

const nextConfig: NextConfig = {
  images: { remotePatterns },
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve("."),
  // FileStore seeds .data/ from these on first read; ship them with the server bundle.
  outputFileTracingIncludes: { "/**": ["./content/**"] },
  async headers() {
    // No script-src here: Next inlines its bootstrap scripts. These parts are safe without nonces.
    return [
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
