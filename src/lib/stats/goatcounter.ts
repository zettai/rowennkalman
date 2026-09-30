/**
 * Visit numbers for the admin dashboard, read from the self-hosted GoatCounter on max-z.
 *
 * GoatCounter sits behind Cloudflare Access: only /count and /count.js are public (browsers
 * report visits there). The API needs a Cloudflare service token to pass Access, plus a
 * GoatCounter API key that can only read statistics. All requests run on the server.
 */

/** Visits before this were never counted; "all time" starts here. */
export const TRACKING_START = "2026-09-30T00:00:00Z";

const TIMEOUT_MS = 5000;
const TOP = 5;

export type StatsConfig = {
  baseUrl: string;
  apiKey: string;
  accessClientId?: string;
  accessClientSecret?: string;
};

type Env = Record<string, string | undefined>;

export type StatRow = { name: string; count: number };

export type VisitStats = {
  allTime: number;
  last30: number;
  last7: number;
  pages: StatRow[];
  referrers: StatRow[];
  countries: StatRow[];
};

/** The public GoatCounter address, or undefined when tracking is off (dev, tests). */
export function trackerUrl(env: Env = process.env): string | undefined {
  return env.ROWENNKALMAN_GOATCOUNTER_URL?.trim().replace(/\/$/, "") || undefined;
}

/** Null when the stats variables are not set, so the card can say so instead of failing. */
export function statsConfig(env: Env = process.env): StatsConfig | null {
  const baseUrl = trackerUrl(env);
  const apiKey = env.ROWENNKALMAN_GOATCOUNTER_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl,
    apiKey,
    accessClientId: headerValue(env.ROWENNKALMAN_CF_ACCESS_CLIENT_ID),
    accessClientSecret: headerValue(env.ROWENNKALMAN_CF_ACCESS_CLIENT_SECRET),
  };
}

/**
 * Cloudflare's copy buttons copy the whole header line ("CF-Access-Client-Id: abc.access"),
 * so accept that as well as the bare value.
 */
function headerValue(raw: string | undefined): string | undefined {
  return raw?.trim().replace(/^CF-Access-Client-(Id|Secret)\s*:\s*/i, "").trim() || undefined;
}

/** The shape of the service token, never its value: enough to tell a bad paste from a bad policy. */
export function accessTokenShape(cfg: StatsConfig): Record<string, unknown> {
  return {
    idSet: !!cfg.accessClientId,
    idLooksLikeId: /^[0-9a-f]{32}\.access$/.test(cfg.accessClientId ?? ""),
    secretSet: !!cfg.accessClientSecret,
  };
}

/** GoatCounter wants hour-aligned ranges; round up so the current hour is included. */
function nextHour(d: Date): Date {
  const t = new Date(d);
  t.setUTCMinutes(0, 0, 0);
  if (t.getTime() < d.getTime()) t.setUTCHours(t.getUTCHours() + 1);
  return t;
}

function daysBefore(end: Date, days: number): Date {
  return new Date(end.getTime() - days * 24 * 3600 * 1000);
}

export async function fetchVisitStats(
  cfg: StatsConfig,
  now: Date = new Date(),
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<VisitStats> {
  const end = nextHour(now);
  const start30 = daysBefore(end, 30);
  const range = (start: Date | string) => ({
    start: typeof start === "string" ? start : start.toISOString(),
    end: end.toISOString(),
  });

  const headers: Record<string, string> = { Authorization: `Bearer ${cfg.apiKey}`, Accept: "application/json" };
  if (cfg.accessClientId && cfg.accessClientSecret) {
    headers["CF-Access-Client-Id"] = cfg.accessClientId;
    headers["CF-Access-Client-Secret"] = cfg.accessClientSecret;
  }

  async function get<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const url = new URL(`${cfg.baseUrl}/api/v0${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await fetchImpl(url, { headers, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    // Access answers a missing or wrong service token with a redirect to its login page.
    if (!res.ok) throw new Error(`GoatCounter ${path}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  type Total = { total: number };
  type Hits = { hits: { path: string; count: number }[] };
  type Stats = { stats: { name: string; count: number }[] };

  const [allTime, last30, last7, hits, refs, locations] = await Promise.all([
    get<Total>("/stats/total", range(TRACKING_START)),
    get<Total>("/stats/total", range(start30)),
    get<Total>("/stats/total", range(daysBefore(end, 7))),
    get<Hits>("/stats/hits", { ...range(start30), limit: TOP }),
    get<Stats>("/stats/toprefs", { ...range(start30), limit: TOP }),
    get<Stats>("/stats/locations", { ...range(start30), limit: TOP }),
  ]);

  const rows = (list: { name: string; count: number }[] | undefined) =>
    (list ?? []).slice(0, TOP).map(({ name, count }) => ({ name: name || "(direct)", count }));

  return {
    allTime: allTime.total,
    last30: last30.total,
    last7: last7.total,
    pages: (hits.hits ?? []).slice(0, TOP).map((h) => ({ name: h.path, count: h.count })),
    referrers: rows(refs.stats),
    countries: rows(locations.stats),
  };
}
