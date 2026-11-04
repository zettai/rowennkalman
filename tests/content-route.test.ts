import seed from "@content/seed.json";
import { ContentSchema } from "@/lib/content/schema";
import { MemoryStore, setStoreForTests } from "@/lib/store";
import { issueSession, SESSION_COOKIE } from "@/lib/auth/session";

const SECRET = "test-secret-test-secret-test-secret-0123456789";
const secret = new TextEncoder().encode(SECRET);

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/server", () => {
  const actual = jest.requireActual<typeof import("next/server")>("next/server");
  return { ...actual, after: (fn: () => void | Promise<void>) => void fn() };
});
jest.mock("@/lib/cdn", () => ({ purgePublicPages: jest.fn() }));
jest.mock("@/lib/page-refresh", () => ({ refreshPublicPages: jest.fn(async () => ({})) }));

const purgePublicPages = jest.requireMock<{ purgePublicPages: jest.Mock }>("@/lib/cdn").purgePublicPages;
const refreshPublicPages = jest.requireMock<{ refreshPublicPages: jest.Mock }>("@/lib/page-refresh").refreshPublicPages;

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    get: (name: string) => (name === SESSION_COOKIE ? { value: sessionToken } : undefined),
  })),
}));

let sessionToken = "";

beforeAll(() => {
  process.env.ROWENNKALMAN_SESSION_SECRET = SECRET;
});

beforeEach(async () => {
  jest.clearAllMocks();
  const store = new MemoryStore(ContentSchema.parse(seed));
  setStoreForTests(store);
  const { token } = await issueSession({ method: "magic-link" }, secret);
  sessionToken = token;
  purgePublicPages.mockResolvedValue("skipped");
});

describe("PUT /api/admin/content", () => {
  it("includes purge in the response when content changed", async () => {
    purgePublicPages.mockResolvedValue("purged");
    const content = ContentSchema.parse(seed);
    const { PUT } = await import("@/app/api/admin/content/route");
    const res = await PUT(
      new Request("http://localhost/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: "home",
          value: { ...content.home, heroTitle: "New title" },
          expectedUpdatedAt: content.updatedAt,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.purge).toBe("purged");
    expect(body.content.home.heroTitle).toBe("New title");
    expect(refreshPublicPages).toHaveBeenCalledWith("save");
  });

  it("does not refresh when purge was skipped", async () => {
    purgePublicPages.mockResolvedValue("skipped");
    const content = ContentSchema.parse(seed);
    const { PUT } = await import("@/app/api/admin/content/route");
    const res = await PUT(
      new Request("http://localhost/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: "home",
          value: { ...content.home, heroSubtitle: "skipped-run" },
          expectedUpdatedAt: content.updatedAt,
        }),
      }),
    );
    expect((await res.json()).purge).toBe("skipped");
    expect(refreshPublicPages).not.toHaveBeenCalled();
  });

  it("does not refresh when purge failed", async () => {
    purgePublicPages.mockResolvedValue("failed");
    const store = new MemoryStore(ContentSchema.parse(seed));
    setStoreForTests(store);
    const content = await store.getContent();
    const { PUT } = await import("@/app/api/admin/content/route");
    refreshPublicPages.mockClear();
    const res = await PUT(
      new Request("http://localhost/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: "about",
          value: { ...content.about, title: "About failed purge" },
          expectedUpdatedAt: content.updatedAt,
        }),
      }),
    );
    expect((await res.json()).purge).toBe("failed");
    expect(refreshPublicPages).not.toHaveBeenCalled();
  });

  it("returns purge null when the save did not apply", async () => {
    const content = ContentSchema.parse(seed);
    const { PUT } = await import("@/app/api/admin/content/route");
    const res = await PUT(
      new Request("http://localhost/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: "home", value: content.home, expectedUpdatedAt: "2099-01-01T00:00:00.000Z" }),
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.purge).toBeNull();
    expect(purgePublicPages).not.toHaveBeenCalled();
  });
});
