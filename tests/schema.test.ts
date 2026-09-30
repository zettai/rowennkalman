import { z } from "zod";
import seed from "@content/seed.json";
import { ContentSchema, collectImageKeys, paragraphs } from "@/lib/content/schema";
import { PAGES, registeredStringPaths, getPath, setPath, ARTWORK_FIELDS } from "@/lib/content/fields";
import { existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Every string leaf of a zod schema, as "a.b[].c" paths. */
function stringLeaves(schema: z.ZodType, prefix = ""): string[] {
  if (schema instanceof z.ZodObject) {
    return Object.entries(schema.shape as Record<string, z.ZodType>).flatMap(([k, v]) =>
      stringLeaves(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  if (schema instanceof z.ZodArray) return stringLeaves(schema.element as z.ZodType, `${prefix}[]`);
  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return stringLeaves(schema.unwrap() as z.ZodType, prefix);
  }
  if (schema instanceof z.ZodString) return [prefix];
  return [];
}

/** Leaves that are deliberately not edited through the text registry. */
function isExcluded(path: string): boolean {
  if (path === "version" || path === "updatedAt") return true;
  if (path.startsWith("portfolio.artworks")) return true; // artwork editor has its own screen
  if (/(^|\.)key$/.test(path)) return true; // image bucket keys
  if (/(^|\.|\[\]\.)id$/.test(path)) return true; // ids
  return false;
}

describe("ContentSchema", () => {
  it("accepts the seed", () => {
    expect(() => ContentSchema.parse(seed)).not.toThrow();
  });

  it("seed has three artworks and placeholder text in every string field", () => {
    const content = ContentSchema.parse(seed);
    expect(content.portfolio.artworks).toHaveLength(3);
    for (const path of stringLeaves(ContentSchema)) {
      if (path.includes("[]")) continue;
      const value = getPath(content, path);
      if (value === undefined) continue; // nullable image not set
      if (path === "contact.image.alt") continue;
      expect([path, typeof value === "string" && value.length > 0]).toEqual([path, true]);
    }
  });

  it("seed images exist, are JPEGs, and stay under 50 KB together", () => {
    const content = ContentSchema.parse(seed);
    const dir = join(__dirname, "..", "content", "seed-images");
    let total = 0;
    for (const key of collectImageKeys(content)) {
      const file = join(dir, key.replace(/^art\//, ""));
      expect(existsSync(file)).toBe(true);
    }
    for (const f of readdirSync(dir)) total += statSync(join(dir, f)).size;
    expect(total).toBeLessThan(50_000);
  });

  it("rejects bad image keys, bad uuids and wrong versions", () => {
    const content = ContentSchema.parse(seed);
    const badKey = setPath(content, "home.heroImage", { key: "../etc/passwd", width: 1, height: 1, alt: "" });
    expect(ContentSchema.safeParse(badKey).success).toBe(false);
    const badVersion = { ...content, version: 2 };
    expect(ContentSchema.safeParse(badVersion).success).toBe(false);
    const badId = setPath(content, "portfolio.artworks", [{ ...content.portfolio.artworks[0], id: "nope" }]);
    expect(ContentSchema.safeParse(badId).success).toBe(false);
  });

  it("collects image keys from every image slot", () => {
    const keys = collectImageKeys(ContentSchema.parse(seed));
    expect([...keys].sort()).toEqual(
      ["art/seed-about.jpg", "art/seed-art-1.jpg", "art/seed-art-2.jpg", "art/seed-art-3.jpg", "art/seed-hero.jpg"].sort(),
    );
  });

  it("splits paragraphs on blank lines", () => {
    expect(paragraphs("a\nb\n\n  \nc\r\n\r\nd")).toEqual(["a\nb", "c", "d"]);
  });
});

describe("field registry", () => {
  it("covers every editable string leaf of ContentSchema", () => {
    const registered = registeredStringPaths();
    const missing = stringLeaves(ContentSchema).filter((p) => !isExcluded(p) && !registered.has(p));
    expect(missing).toEqual([]);
  });

  it("does not register paths that are not in the schema", () => {
    const leaves = new Set(stringLeaves(ContentSchema));
    const unknown = [...registeredStringPaths()].filter((p) => !leaves.has(p));
    expect(unknown).toEqual([]);
  });

  it("covers every artwork text field", () => {
    const artworkLeaves = stringLeaves(ContentSchema)
      .filter((p) => p.startsWith("portfolio.artworks[]."))
      .map((p) => p.slice("portfolio.artworks[].".length))
      .filter((p) => !isExcluded(p));
    const registered = ARTWORK_FIELDS.map((f) => f.path);
    expect(artworkLeaves.filter((p) => !p.startsWith("image.")).sort()).toEqual([...registered].sort());
  });

  it("gives every field a label and a one-line hint, and keeps each field on its own page", () => {
    for (const page of PAGES) {
      for (const section of page.sections) {
        for (const field of section.fields) {
          expect(field.label.trim()).not.toBe("");
          expect(field.hint.trim()).not.toBe("");
          expect(field.hint).not.toMatch(/\n/);
          expect(field.path.split(".")[0]).toBe(page.key);
        }
      }
    }
  });

  it("getPath and setPath are immutable and symmetric", () => {
    const content = ContentSchema.parse(seed);
    const next = setPath(content, "site.nav.home", "Start");
    expect(getPath(next, "site.nav.home")).toBe("Start");
    expect(content.site.nav.home).toBe("Home");
    expect(next.site.footer).toBe(content.site.footer);
  });
});
