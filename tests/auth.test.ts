import { SignJWT, UnsecuredJWT } from "jose";
import { NextRequest } from "next/server";
import { issueSession, verifySession, sessionSecret, SESSION_COOKIE, SESSION_TTL_SECONDS, sessionCookieOptions } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/login-next";
import {
  allowedEmails,
  issueLoginLinkToken,
  redeemLoginLink,
  requestLoginLink,
  verifyLoginLinkToken,
  LINK_TTL_SECONDS,
  type LinkMailer,
} from "@/lib/auth/magic-link";
import { createRateLimiter } from "@/lib/rate-limit";
import { middleware } from "@/middleware";

const SECRET = "test-secret-test-secret-test-secret-0123456789";
const secret = new TextEncoder().encode(SECRET);
const env = { ROWENNKALMAN_SESSION_SECRET: SECRET, ROWENNKALMAN_ADMIN_EMAILS: "Editor@Example.com, other@example.org" };

beforeAll(() => {
  process.env.ROWENNKALMAN_SESSION_SECRET = SECRET;
});

class RecordingMailer implements LinkMailer {
  sent: { to: string; url: string }[] = [];
  async sendLoginLink(to: string, url: string) {
    this.sent.push({ to, url });
  }
}
const limiters = () => ({
  ipLimiter: createRateLimiter({ limit: 50, windowMs: 1000 }),
  emailLimiter: createRateLimiter({ limit: 50, windowMs: 1000 }),
});

describe("magic link", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.9" });
  const origin = "https://rowennkalman.com";

  it("reads the allowlist, trimmed and case-insensitive, ignoring junk", () => {
    expect(allowedEmails({ ROWENNKALMAN_ADMIN_EMAILS: " A@B.co ,, not-an-email, c@d.org" })).toEqual(new Set(["a@b.co", "c@d.org"]));
    expect(allowedEmails({})).toEqual(new Set());
  });

  it("emails a working link to an allowed address, pointing at the given origin", async () => {
    const mailer = new RecordingMailer();
    const out = await requestLoginLink({ email: " editor@EXAMPLE.com ", next: "/admin/portfolio" }, headers, origin, { mailer, env, ...limiters() });
    expect(out).toEqual({ ok: true });
    expect(mailer.sent).toHaveLength(1);
    const { to, url } = mailer.sent[0]!;
    expect(to).toBe("editor@example.com");
    const link = new URL(url);
    expect(link.origin + link.pathname).toBe("https://rowennkalman.com/api/auth/magic-link");
    const redeemed = await redeemLoginLink(link.searchParams.get("token"), { env });
    expect(redeemed?.next).toBe("/admin/portfolio");
    const session = await verifySession(redeemed!.sessionToken, secret);
    expect(session).toMatchObject({ subject: "editor@example.com", method: "magic-link" });
  });

  it("answers the same for an address that may not sign in, and sends nothing", async () => {
    const mailer = new RecordingMailer();
    expect(await requestLoginLink({ email: "stranger@example.net", next: null }, headers, origin, { mailer, env, ...limiters() })).toEqual({ ok: true });
    expect(mailer.sent).toHaveLength(0);
  });

  it("refuses something that isn't an email address", async () => {
    const mailer = new RecordingMailer();
    expect(await requestLoginLink({ email: "nope", next: null }, headers, origin, { mailer, env, ...limiters() })).toEqual({ ok: false, reason: "invalid" });
    expect(await requestLoginLink({ email: undefined, next: null }, headers, origin, { mailer, env, ...limiters() })).toEqual({ ok: false, reason: "invalid" });
  });

  it("rate-limits per IP and quietly stops mailing one address", async () => {
    const mailer = new RecordingMailer();
    const ipLimiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    const emailLimiter = createRateLimiter({ limit: 50, windowMs: 60_000 });
    for (let i = 0; i < 2; i++) await requestLoginLink({ email: "editor@example.com", next: null }, headers, origin, { mailer, env, ipLimiter, emailLimiter });
    expect(await requestLoginLink({ email: "editor@example.com", next: null }, headers, origin, { mailer, env, ipLimiter, emailLimiter })).toEqual({
      ok: false,
      reason: "limited",
    });
    const perEmail = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const m2 = new RecordingMailer();
    const other = new Headers({ "x-forwarded-for": "198.51.100.1" });
    const ip2 = createRateLimiter({ limit: 50, windowMs: 60_000 });
    await requestLoginLink({ email: "other@example.org", next: null }, other, origin, { mailer: m2, env, ipLimiter: ip2, emailLimiter: perEmail });
    expect(await requestLoginLink({ email: "other@example.org", next: null }, other, origin, { mailer: m2, env, ipLimiter: ip2, emailLimiter: perEmail })).toEqual({
      ok: true,
    });
    expect(m2.sent).toHaveLength(1);
  });

  it("rejects expired, forged and no-longer-allowed links, and link tokens used as sessions", async () => {
    const now = Math.floor(Date.now() / 1000);
    const old = await issueLoginLinkToken("editor@example.com", "/admin", secret, now - LINK_TTL_SECONDS - 5);
    expect(await verifyLoginLinkToken(old, { env })).toBeNull();
    const forged = await issueLoginLinkToken("editor@example.com", "/admin", new TextEncoder().encode("z".repeat(40)));
    expect(await verifyLoginLinkToken(forged, { env })).toBeNull();
    const removed = await issueLoginLinkToken("gone@example.com", "/admin", secret);
    expect(await verifyLoginLinkToken(removed, { env })).toBeNull();
    const fresh = await issueLoginLinkToken("editor@example.com", "https://evil.example", secret);
    expect(await verifyLoginLinkToken(fresh, { env })).toEqual({ email: "editor@example.com", next: "/admin" });
    expect(await verifySession(fresh, secret)).toBeNull(); // different audience
    expect(await verifyLoginLinkToken(null, { env })).toBeNull();
  });
});

describe("session tokens", () => {
  it("round-trips a fresh session", async () => {
    const { token, session } = await issueSession({ method: "magic-link" }, secret);
    expect(await verifySession(token, secret)).toEqual(session);
    expect(session.expiresAt - session.issuedAt).toBe(7 * 24 * 3600);
  });
  it("rejects an expired token", async () => {
    const eightDaysAgo = Math.floor(Date.now() / 1000) - 8 * 24 * 3600;
    const { token } = await issueSession({ method: "magic-link" }, secret, eightDaysAgo);
    expect(await verifySession(token, secret)).toBeNull();
  });
  it("rejects a token forged with another secret", async () => {
    const { token } = await issueSession({ method: "magic-link" }, new TextEncoder().encode("x".repeat(40)));
    expect(await verifySession(token, secret)).toBeNull();
  });
  it("rejects a tampered payload", async () => {
    const { token } = await issueSession({ method: "magic-link" }, secret);
    const [h, p, s] = token.split(".");
    const payload = JSON.parse(Buffer.from(p!, "base64url").toString());
    payload.sub = "attacker";
    const forged = [h, Buffer.from(JSON.stringify(payload)).toString("base64url"), s].join(".");
    expect(await verifySession(forged, secret)).toBeNull();
  });
  it("rejects alg=none and wrong audience", async () => {
    const none = new UnsecuredJWT({ method: "magic-link" }).setSubject("owner").setExpirationTime("1h").encode();
    expect(await verifySession(none, secret)).toBeNull();
    const wrongAud = await new SignJWT({ method: "magic-link" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("owner")
      .setIssuedAt()
      .setExpirationTime("1h")
      .setAudience("someone-else")
      .sign(secret);
    expect(await verifySession(wrongAud, secret)).toBeNull();
  });
  it("rejects garbage and empty tokens", async () => {
    expect(await verifySession("not.a.jwt", secret)).toBeNull();
    expect(await verifySession("", secret)).toBeNull();
    expect(await verifySession(undefined, secret)).toBeNull();
  });
  it("requires a long session secret", () => {
    expect(() => sessionSecret({ ROWENNKALMAN_SESSION_SECRET: "short" })).toThrow(/32/);
  });
  it("uses an httpOnly, Secure, SameSite=Lax, 7-day cookie", () => {
    expect(sessionCookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_TTL_SECONDS });
  });
});

describe("post-login destination", () => {
  it("never redirects off-site", () => {
    expect(safeNext("https://evil.example/admin")).toBe("/admin");
    expect(safeNext("//evil.example")).toBe("/admin");
    expect(safeNext("/admin/../api")).toBe("/admin");
    expect(safeNext("/admin/login")).toBe("/admin");
    expect(safeNext("/admin/home")).toBe("/admin/home");
  });
});

describe("middleware", () => {
  const req = (path: string, init: { cookie?: string; method?: string; origin?: string } = {}) => {
    const headers = new Headers({ host: "localhost:3000" });
    if (init.cookie) headers.set("cookie", `${SESSION_COOKIE}=${init.cookie}`);
    if (init.origin) headers.set("origin", init.origin);
    return new NextRequest(`http://localhost:3000${path}`, { method: init.method ?? "GET", headers });
  };

  it("redirects admin pages to login without a session", async () => {
    const res = await middleware(req("/admin/home"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/admin/login?next=%2Fadmin%2Fhome");
  });
  it("lets the login page through", async () => {
    const res = await middleware(req("/admin/login"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
  it("answers 401 for admin API without a session, or with a forged/expired one", async () => {
    expect((await middleware(req("/api/admin/content"))).status).toBe(401);
    const { token: forged } = await issueSession({ method: "magic-link" }, new TextEncoder().encode("y".repeat(40)));
    expect((await middleware(req("/api/admin/content", { cookie: forged }))).status).toBe(401);
    const { token: old } = await issueSession({ method: "magic-link" }, secret, Math.floor(Date.now() / 1000) - 8 * 86400);
    expect((await middleware(req("/api/admin/content", { cookie: old }))).status).toBe(401);
  });
  it("passes a valid session", async () => {
    const { token } = await issueSession({ method: "magic-link" }, secret);
    const res = await middleware(req("/admin/home", { cookie: token }));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("blocks cross-origin writes to the admin API", async () => {
    const { token } = await issueSession({ method: "magic-link" }, secret);
    const res = await middleware(req("/api/admin/content", { cookie: token, method: "PUT", origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    const ok = await middleware(req("/api/admin/content", { cookie: token, method: "PUT", origin: "http://localhost:3000" }));
    expect(ok.headers.get("x-middleware-next")).toBe("1");
  });
});
