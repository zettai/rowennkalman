import { handleSave } from "@/lib/admin/handlers";
import { MemoryStore } from "@/lib/store";

describe("save handler", () => {
  it("saves one page and returns the new content and image URLs", async () => {
    const store = new MemoryStore();
    const c = await store.getContent();
    const res = await handleSave(store, { page: "home", value: { ...c.home, heroTitle: "Hello" }, expectedUpdatedAt: c.updatedAt });
    expect(res.status).toBe(200);
    const body = res.body as { content: typeof c; imageUrls: Record<string, string> };
    expect(body.content.home.heroTitle).toBe("Hello");
    expect(body.content.about).toEqual(c.about);
    expect(body.imageUrls["art/seed-hero.jpg"]).toBe("/memory-images/art/seed-hero.jpg");
    expect(res.changed).toBe(true);
  });
  it("answers 409 for a stale token", async () => {
    const store = new MemoryStore();
    const c = await store.getContent();
    await handleSave(store, { page: "home", value: c.home, expectedUpdatedAt: c.updatedAt });
    const res = await handleSave(store, { page: "about", value: c.about, expectedUpdatedAt: c.updatedAt });
    expect(res.status).toBe(409);
    expect(res.changed).toBeUndefined();
  });
  it("answers 400 for unknown pages and invalid values", async () => {
    const store = new MemoryStore();
    const c = await store.getContent();
    expect((await handleSave(store, { page: "version", value: 2, expectedUpdatedAt: c.updatedAt })).status).toBe(400);
    expect((await handleSave(store, { page: "home", value: { heroTitle: 5 }, expectedUpdatedAt: c.updatedAt })).status).toBe(400);
    expect((await handleSave(store, "nonsense")).status).toBe(400);
    expect((await store.getContent()).updatedAt).toBe(c.updatedAt);
  });
});
