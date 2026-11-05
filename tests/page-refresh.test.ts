import { REFRESH_ACCEPT_ENCODINGS, PUBLIC_PAGE_PATHS } from "@/lib/page-cache";
import { refreshPublicPages } from "@/lib/page-refresh";

jest.mock("@/lib/log", () => ({ logEvent: jest.fn() }));
import { logEvent } from "@/lib/log";

const BASE = new URL("https://cache-test.example/");

describe("refreshPublicPages", () => {
  beforeEach(() => {
    process.env.ROWENNKALMAN_SITE_URL = BASE.origin;
  });

  it("requests every public page for each Accept-Encoding from siteUrl()", async () => {
    const urls: string[] = [];
    const responses: Response[] = [];
    const fetchFn = jest.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      const res = new Response("<html></html>", { status: 200 });
      responses.push(res);
      return res;
    }) as typeof fetch;
    jest.mocked(logEvent).mockClear();

    await refreshPublicPages("save", { baseUrl: BASE, fetchFn, timeoutMs: 5000 });

    expect(fetchFn).toHaveBeenCalledTimes(PUBLIC_PAGE_PATHS.length * REFRESH_ACCEPT_ENCODINGS.length);
    expect(responses).toHaveLength(PUBLIC_PAGE_PATHS.length * REFRESH_ACCEPT_ENCODINGS.length);
    for (const res of responses) expect(res.bodyUsed).toBe(true);
    for (const path of PUBLIC_PAGE_PATHS) {
      const expected = `${BASE.origin}${path === "/" ? "/" : path}`;
      expect(urls.filter((u) => u === expected || u === expected.replace(/\/$/, "") || u.startsWith(expected))).not.toHaveLength(0);
    }
    expect(logEvent).toHaveBeenCalledWith("refresh", expect.objectContaining({ trigger: "save" }));
  });

  it("records HTTP 500 and does not throw", async () => {
    const responses: Response[] = [];
    const fetchFn = jest.fn(async () => {
      const res = new Response("error page", { status: 500 });
      responses.push(res);
      return res;
    }) as typeof fetch;
    jest.mocked(logEvent).mockClear();

    const summary = await refreshPublicPages("retry", { baseUrl: BASE, fetchFn, timeoutMs: 5000 });

    expect(summary["/"]![REFRESH_ACCEPT_ENCODINGS[0]!]).toBe(500);
    expect(responses.every((r) => r.bodyUsed)).toBe(true);
  });

  it("records timeout without throwing", async () => {
    jest.useFakeTimers();
    const fetchFn = jest.fn((_url: unknown, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }) as typeof fetch;
    jest.mocked(logEvent).mockClear();

    const pending = refreshPublicPages("save", { baseUrl: BASE, fetchFn, timeoutMs: 100 });
    await jest.advanceTimersByTimeAsync(250);
    const summary = await pending;

    expect(summary["/about"]![REFRESH_ACCEPT_ENCODINGS[1]!]).toBe("timeout");
    jest.useRealTimers();
  });

  it("does not let one slow page block the rest beyond the per-request timeout", async () => {
    const slowPath = "/about";
    const fetchFn = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === slowPath) {
        return new Promise<Response>((resolve, reject) => {
          const late = setTimeout(() => resolve(new Response("", { status: 200 })), 500);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(late);
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }
      return Promise.resolve(new Response("", { status: 200 }));
    }) as typeof fetch;
    jest.mocked(logEvent).mockClear();

    const started = Date.now();
    const summary = await refreshPublicPages("save", { baseUrl: BASE, fetchFn, timeoutMs: 100 });
    const elapsed = Date.now() - started;

    expect(summary[slowPath]![REFRESH_ACCEPT_ENCODINGS[0]!]).toBe("timeout");
    expect(summary["/"]![REFRESH_ACCEPT_ENCODINGS[0]!]).toBe(200);
    expect(elapsed).toBeLessThan(400);
  });

  it("records timeout when the response body never finishes", async () => {
    jest.useFakeTimers();
    const fetchFn = jest.fn(
      () =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              pull() {
                /* stall: body read never completes until abort */
              },
            }),
            { status: 200 },
          ),
        ),
    ) as typeof fetch;
    jest.mocked(logEvent).mockClear();

    const pending = refreshPublicPages("save", { baseUrl: BASE, fetchFn, timeoutMs: 100 });
    await jest.advanceTimersByTimeAsync(250);
    const summary = await pending;

    expect(summary["/"]![REFRESH_ACCEPT_ENCODINGS[0]!]).toBe("timeout");
    jest.useRealTimers();
  });
});
