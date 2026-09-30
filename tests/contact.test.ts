import { handleContact } from "@/lib/contact/handler";
import { checkContact, MIN_FILL_MS } from "@/lib/contact/validate";
import { ConsoleMailer, getMailer, ResendMailer, type Mailer } from "@/lib/contact/mailer";
import { createRateLimiter } from "@/lib/rate-limit";

const NOW = 1_800_000_000_000;
const good = { name: "Test Person", email: "test@example.com", message: "Hello there, lovely herons.", website: "", startedAt: NOW - 10_000 };
const headers = (ip = "192.0.2.1") => new Headers({ "x-forwarded-for": ip });

function spyMailer() {
  const sent: unknown[] = [];
  const mailer: Mailer = { send: async (m) => void sent.push(m) };
  return { mailer, sent };
}
const limiter = () => createRateLimiter({ limit: 100, windowMs: 60_000 });

describe("contact API", () => {
  it("sends a valid message", async () => {
    const { mailer, sent } = spyMailer();
    const res = await handleContact(good, headers(), { mailer, limiter: limiter(), now: NOW });
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(sent).toEqual([{ name: "Test Person", email: "test@example.com", message: "Hello there, lovely herons." }]);
  });

  it("honeypot: pretends success and sends nothing", async () => {
    const { mailer, sent } = spyMailer();
    const res = await handleContact({ ...good, website: "http://spam.example" }, headers(), { mailer, limiter: limiter(), now: NOW });
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(sent).toHaveLength(0);
  });

  it("timing: rejects forms sent under 3 seconds after they appeared", async () => {
    const { mailer, sent } = spyMailer();
    const fast = await handleContact({ ...good, startedAt: NOW - (MIN_FILL_MS - 1) }, headers(), { mailer, limiter: limiter(), now: NOW });
    expect(fast.status).toBe(400);
    expect(fast.body.field).toBe("startedAt");
    const exact = await handleContact({ ...good, startedAt: NOW - MIN_FILL_MS }, headers(), { mailer, limiter: limiter(), now: NOW });
    expect(exact.status).toBe(200);
    const future = await handleContact({ ...good, startedAt: NOW + 60_000 }, headers(), { mailer, limiter: limiter(), now: NOW });
    expect(future.status).toBe(400);
    expect(sent).toHaveLength(1);
  });

  it("limits: name, email format, message length", () => {
    expect(checkContact({ ...good, name: "  " }, NOW)).toMatchObject({ kind: "invalid", field: "name" });
    expect(checkContact({ ...good, name: "x".repeat(101) }, NOW)).toMatchObject({ kind: "invalid", field: "name" });
    for (const email of ["nope", "a@b", "a b@c.de", "a@b.c", "<a@b.cd>", `${"x".repeat(250)}@b.cd`]) {
      expect([email, checkContact({ ...good, email }, NOW).kind]).toEqual([email, "invalid"]);
    }
    expect(checkContact({ ...good, email: "first.last+tag@sub.example.org" }, NOW).kind).toBe("ok");
    expect(checkContact({ ...good, message: "" }, NOW)).toMatchObject({ kind: "invalid", field: "message" });
    expect(checkContact({ ...good, message: "x".repeat(5001) }, NOW)).toMatchObject({ kind: "invalid", field: "message" });
    expect(checkContact({ ...good, message: "x".repeat(5000) }, NOW).kind).toBe("ok");
  });

  it("rejects wrong types and missing fields", () => {
    expect(checkContact({ ...good, startedAt: "yesterday" }, NOW).kind).toBe("invalid");
    expect(checkContact({ name: "a" }, NOW).kind).toBe("invalid");
    expect(checkContact(null, NOW).kind).toBe("invalid");
  });

  it("strips control characters and header-breaking newlines from the name", () => {
    const res = checkContact({ ...good, name: "Eve\r\nBcc: x@y.z", message: "line 1\nline 2\u0007" }, NOW);
    expect(res).toMatchObject({ kind: "ok", message: { name: "Eve  Bcc: x@y.z", message: "line 1\nline 2" } });
  });

  it("rate-limits per IP", async () => {
    const { mailer, sent } = spyMailer();
    const l = createRateLimiter({ limit: 2, windowMs: 60_000 });
    for (let i = 0; i < 2; i++) expect((await handleContact(good, headers(), { mailer, limiter: l, now: NOW })).status).toBe(200);
    expect((await handleContact(good, headers(), { mailer, limiter: l, now: NOW })).status).toBe(429);
    expect((await handleContact(good, headers("192.0.2.2"), { mailer, limiter: l, now: NOW })).status).toBe(200);
    expect(sent).toHaveLength(3);
  });

  it("reports a mailer failure as 502 without leaking details", async () => {
    const mailer: Mailer = { send: async () => Promise.reject(new Error("secret upstream detail")) };
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleContact(good, headers(), { mailer, limiter: limiter(), now: NOW });
    spy.mockRestore();
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });
});

describe("mailers", () => {
  it("ResendMailer posts the expected request, with reply_to set to the sender", async () => {
    const calls: [string, RequestInit][] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify({ id: "x" }), { status: 200 });
    }) as unknown as typeof fetch;
    const m = new ResendMailer({ apiKey: "re_test_key", to: "owner@example.com", from: "Site <site@example.com>" }, fakeFetch);
    await m.send({ name: "Test\nPerson", email: "test@example.com", message: "Hi" });
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      from: "Site <site@example.com>",
      to: ["owner@example.com"],
      reply_to: "test@example.com",
      subject: "Website message from Test Person",
    });
    expect(body.text).toContain("Hi");
  });

  it("ResendMailer throws on an error response", async () => {
    const fakeFetch = (async () => new Response("bad key", { status: 401 })) as unknown as typeof fetch;
    const m = new ResendMailer({ apiKey: "k", to: "a@example.com", from: "b@example.com" }, fakeFetch);
    await expect(m.send({ name: "a", email: "a@example.com", message: "hi" })).rejects.toThrow(/401/);
  });

  it("getMailer picks ConsoleMailer without a key, and requires TO/FROM with one", () => {
    expect(getMailer({})).toBeInstanceOf(ConsoleMailer);
    expect(getMailer({ ROWENNKALMAN_RESEND_API_KEY: "k", ROWENNKALMAN_CONTACT_TO: "a@example.com", ROWENNKALMAN_CONTACT_FROM: "b@example.com" })).toBeInstanceOf(
      ResendMailer,
    );
    expect(() => getMailer({ ROWENNKALMAN_RESEND_API_KEY: "k" })).toThrow(/CONTACT_TO/);
  });
});

describe("sender name", () => {
  it("adds the site's name to a bare address and keeps an existing one", async () => {
    const { withSenderName } = await import("@/lib/contact/mailer");
    expect(withSenderName("web@rowennkalman.com")).toBe("Rowenn Beth Kalman <web@rowennkalman.com>");
    expect(withSenderName("Someone <a@b.co>")).toBe("Someone <a@b.co>");
  });
});
