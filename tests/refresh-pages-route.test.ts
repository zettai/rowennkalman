import { issueSession, SESSION_COOKIE } from "@/lib/auth/session";
import { createRateLimiter } from "@/lib/rate-limit";

const SECRET = "test-secret-test-secret-test-secret-0123456789";
const secret = new TextEncoder().encode(SECRET);

jest.mock("@/lib/cdn", () => ({ purgePublicPages: jest.fn() }));
jest.mock("@/lib/page-refresh", () => ({ refreshPublicPages: jest.fn(async () => ({ "/": { br: 200 } })) }));
jest.mock("@/lib/admin/handlers", () => {
  const actual = jest.requireActual<typeof import("@/lib/admin/handlers")>("@/lib/admin/handlers");
  return { ...actual, siteRefreshLimiter: createRateLimiter({ limit: 100, windowMs: 60_000 }) };
});

const purgePublicPages = jest.requireMock<{ purgePublicPages: jest.Mock }>("@/lib/cdn").purgePublicPages;
const refreshPublicPages = jest.requireMock<{ refreshPublicPages: jest.Mock }>("@/lib/page-refresh").refreshPublicPages;

let sessionToken = "";

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    get: (name: string) => (name === SESSION_COOKIE ? { value: sessionToken } : undefined),
  })),
}));

beforeAll(() => {
  process.env.ROWENNKALMAN_SESSION_SECRET = SECRET;
});

beforeEach(async () => {
  jest.clearAllMocks();
  const { token } = await issueSession({ method: "magic-link" }, secret);
  sessionToken = token;
  purgePublicPages.mockResolvedValue("purged");
});

describe("POST /api/admin/refresh-pages", () => {
  it("returns 401 without a session", async () => {
    sessionToken = "";
    const { POST } = await import("@/app/api/admin/refresh-pages/route");
    const res = await POST(new Request("http://localhost/api/admin/refresh-pages", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("purges then refreshes with trigger retry when signed in", async () => {
    const { POST } = await import("@/app/api/admin/refresh-pages/route");
    const res = await POST(new Request("http://localhost/api/admin/refresh-pages", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.purge).toBe("purged");
    expect(refreshPublicPages).toHaveBeenCalledWith("retry");
    expect(body.refresh).toEqual({ "/": { br: 200 } });
  });

  it("rejects non-POST methods", async () => {
    const { GET } = await import("@/app/api/admin/refresh-pages/route");
    const res = await GET();
    expect(res.status).toBe(405);
  });
});

describe("proxy", () => {
  it("returns 401 for refresh-pages without a session", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");
    const res = await proxy(new NextRequest("http://localhost:3000/api/admin/refresh-pages", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});
