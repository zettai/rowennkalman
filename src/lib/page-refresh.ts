import { siteUrl } from "@/components/site/content";
import { logEvent } from "@/lib/log";
import { PUBLIC_PAGE_PATHS, REFRESH_ACCEPT_ENCODINGS, REFRESH_USER_AGENT } from "@/lib/page-cache";

export type RefreshPageStatus = number | "timeout" | "error";

/** Per path, per Accept-Encoding header value → HTTP status or failure reason. */
export type RefreshSummary = Record<string, Record<string, RefreshPageStatus>>;

const REQUEST_TIMEOUT_MS = 8000;

type RefreshDeps = {
  baseUrl: URL;
  fetchFn: typeof fetch;
  timeoutMs: number;
};

function defaultDeps(): RefreshDeps {
  return { baseUrl: siteUrl(), fetchFn: fetch, timeoutMs: REQUEST_TIMEOUT_MS };
}

async function fetchOne(
  url: URL,
  encoding: string,
  deps: RefreshDeps,
): Promise<RefreshPageStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    const res = await deps.fetchFn(url, {
      method: "GET",
      headers: {
        Accept: "text/html",
        "Accept-Encoding": encoding,
        "User-Agent": REFRESH_USER_AGENT,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    return res.status;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "timeout";
    return "error";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Requests each public page twice (Chrome- and Safari-like Accept-Encoding) so the CDN holds
 * warmed copies. Never throws. Base URL comes from siteUrl() only.
 */
export async function refreshPublicPages(
  trigger: "save" | "retry",
  overrides: Partial<RefreshDeps> = {},
): Promise<RefreshSummary> {
  const deps = { ...defaultDeps(), ...overrides };
  const started = Date.now();
  const pages: RefreshSummary = {};

  for (const encoding of REFRESH_ACCEPT_ENCODINGS) {
    const results = await Promise.all(
      PUBLIC_PAGE_PATHS.map(async (path) => {
        const url = new URL(path, deps.baseUrl);
        const status = await fetchOne(url, encoding, deps);
        return { path, status };
      }),
    );
    for (const { path, status } of results) {
      if (!pages[path]) pages[path] = {};
      pages[path]![encoding] = status;
    }
  }

  logEvent("refresh", { trigger, pages, ms: Date.now() - started });
  return pages;
}
