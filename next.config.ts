import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The old thesis landing page. The PDFs under /tesis/*.pdf are served as-is from public/.
    return [
      { source: "/tesis", destination: "/research", permanent: true },
      { source: "/tesis/", destination: "/research", permanent: true },
      { source: "/tesis/index.html", destination: "/research", permanent: true },
    ];
  },
};

export default nextConfig;
