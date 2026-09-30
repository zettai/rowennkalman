import seed from "@content/seed.json";
import { ContentSchema } from "@/lib/content/schema";
import { MemoryStore, setStoreForTests } from "@/lib/store";

// Next.js replaces (doesn't merge) a parent's openGraph, so each page must carry the full block.
const pages = ["about", "portfolio", "research", "contact"] as const;

beforeAll(() => setStoreForTests(new MemoryStore(ContentSchema.parse(seed))));
afterAll(() => setStoreForTests(undefined));

describe("page metadata", () => {
  it.each(pages)("%s has its own description and a full link preview (site name, type, painting)", async (name) => {
    const mod = await import(`@/app/(site)/${name}/page`);
    const meta = await mod.generateMetadata();
    expect(typeof meta.description).toBe("string");
    expect(meta.description.length).toBeGreaterThan(20);
    expect(meta.openGraph).toMatchObject({ siteName: seed.site.name, type: "website", url: `/${name}` });
    expect(meta.openGraph.images).toHaveLength(1);
    expect(meta.alternates.canonical).toBe(`/${name}`);
  });
});
