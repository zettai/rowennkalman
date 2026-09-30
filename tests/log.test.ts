import { changedPaths } from "@/lib/log";

describe("changedPaths", () => {
  it("names exactly the fields that changed", () => {
    const before = { heroTitle: "A", heroSubtitle: "Artist", featured: ["x", "y"], img: { key: "k", alt: "a" } };
    const after = { heroTitle: "A", heroSubtitle: "Artist!", featured: ["y", "x"], img: { key: "k", alt: "b" } };
    expect(changedPaths(before, after, "home")).toEqual(["home.heroSubtitle", "home.featured.0", "home.featured.1", "home.img.alt"]);
  });
  it("is empty when nothing changed, and handles null and type changes", () => {
    expect(changedPaths({ a: 1 }, { a: 1 })).toEqual([]);
    expect(changedPaths({ img: null }, { img: { key: "k" } })).toEqual(["img"]);
  });
});
