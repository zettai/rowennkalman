import nextConfig from "../next.config";
import { PAGE_CDN_SECONDS, PAGE_CACHE_TAG, PUBLIC_PAGE_PATHS } from "@/lib/page-cache";

describe("next.config headers", () => {
  it("caches each public page for one year, durable, tagged, without stale-while-revalidate", async () => {
    const rules = await nextConfig.headers!();
    for (const path of PUBLIC_PAGE_PATHS) {
      const rule = rules.find((r) => r.source === path);
      expect(rule).toBeDefined();
      const cdn = rule!.headers.find((h) => h.key === "Netlify-CDN-Cache-Control")!.value;
      expect(cdn).toContain(`s-maxage=${PAGE_CDN_SECONDS}`);
      expect(PAGE_CDN_SECONDS).toBe(31536000);
      expect(cdn).toContain("durable");
      expect(cdn).not.toMatch(/stale-while-revalidate/i);
      expect(rule!.headers.find((h) => h.key === "Netlify-Cache-Tag")!.value).toBe(PAGE_CACHE_TAG);
    }
  });
});
