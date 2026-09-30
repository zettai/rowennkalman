import seed from "@content/seed.json";
import { ContentSchema } from "@/lib/content/schema";
import { artworksJsonLd, excerpt, jsonLdGraph, pageDescription, personJsonLd, researchJsonLd } from "@/components/site/seo";

const content = ContentSchema.parse(seed);
const base = new URL("https://example.org");
const img = (k: string) => `https://img.example.org/${k}`;

describe("search descriptions", () => {
  it("uses the page's own description first, then the start of its text, then the site's", () => {
    expect(pageDescription("Own words.", "Body text.", content.site)).toBe("Own words.");
    expect(pageDescription("", "First paragraph.\n\nSecond.", content.site)).toBe("First paragraph. Second.");
    expect(pageDescription("  ", "", content.site)).toBe(content.site.metaDescription);
  });
  it("cuts long text on a word boundary under 156 characters", () => {
    const long = "word ".repeat(80).trim();
    const e = excerpt(long);
    expect(e.length).toBeLessThanOrEqual(155);
    expect(e.endsWith("…")).toBe(true);
    expect(e).not.toMatch(/\s…$/);
  });
  it("accepts older content without the new fields", () => {
    const old = JSON.parse(JSON.stringify(seed));
    delete old.about.seoDescription;
    expect(ContentSchema.parse(old).about.seoDescription).toBe("");
  });
});

describe("structured data", () => {
  it("describes the artist with only facts from the content", () => {
    const p = personJsonLd(content, base, img);
    expect(p).toMatchObject({ "@type": "Person", name: content.site.name, url: "https://example.org/" });
    expect(p.sameAs).toEqual([content.site.footer.followUrl]);
  });
  it("lists every painting as a VisualArtwork with its image, and leaves out empty fields", () => {
    const graph = JSON.parse(jsonLdGraph([artworksJsonLd(content, base, img)]));
    const items = graph["@graph"][0].mainEntity.itemListElement;
    expect(items).toHaveLength(content.portfolio.artworks.length);
    const first = items[0].item;
    expect(first["@type"]).toBe("VisualArtwork");
    expect(first.image.contentUrl).toBe(img(content.portfolio.artworks[0]!.image.key));
    for (const it of items) for (const v of Object.values(it.item)) expect(v).not.toBe("");
  });
  it("gives every document an absolute URL: on-site paths join the site's address, others stay as they are", () => {
    const withLocal = {
      ...content,
      research: { ...content.research, documents: [...content.research.documents, { id: "t", labelEn: "Thesis", labelEs: "Tesis", href: "/tesis/t.pdf" }] },
    };
    const r = researchJsonLd(withLocal, base) as { hasPart: { url: string; encodingFormat?: string }[] };
    for (const d of r.hasPart) expect(d.url).toMatch(/^https:\/\//);
    expect(r.hasPart.at(-1)).toMatchObject({ url: "https://example.org/tesis/t.pdf", encodingFormat: "application/pdf" });
  });
  it("can't be broken out of its script tag", () => {
    expect(jsonLdGraph([{ name: "</script><script>alert(1)</script>" }])).not.toContain("</script>");
  });
});
