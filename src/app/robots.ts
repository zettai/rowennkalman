import type { MetadataRoute } from "next";
import { siteUrl } from "@/components/site/content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
