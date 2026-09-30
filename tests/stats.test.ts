import { accessTokenShape, fetchVisitStats, statsConfig, trackerUrl, TRACKING_START } from "@/lib/stats/goatcounter";

const cfg = { baseUrl: "https://stats.test", apiKey: "k", accessClientId: "id", accessClientSecret: "sec" };

function fakeGoatCounter(status = 200) {
  const calls: { url: URL; headers: Record<string, string> }[] = [];
  const impl = (async (input: URL, init?: RequestInit) => {
    calls.push({ url: input, headers: init?.headers as Record<string, string> });
    const path = input.pathname;
    const body = path.endsWith("/stats/total")
      ? { total: input.searchParams.get("start") === TRACKING_START ? 900 : input.searchParams.get("start")!.startsWith("2026-10-08") ? 40 : 200 }
      : path.endsWith("/stats/hits")
        ? { hits: [{ path: "/", count: 120 }, { path: "/portfolio", count: 50 }] }
        : path.endsWith("/stats/toprefs")
          ? { stats: [{ name: "", count: 80 }, { name: "instagram.com", count: 30 }] }
          : { stats: [{ name: "United States", count: 150 }] };
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

describe("statsConfig / trackerUrl", () => {
  it("is off unless both the address and the key are set", () => {
    expect(statsConfig({})).toBeNull();
    expect(statsConfig({ ROWENNKALMAN_GOATCOUNTER_URL: "https://s.test" })).toBeNull();
    expect(
      statsConfig({ ROWENNKALMAN_GOATCOUNTER_URL: "https://s.test/", ROWENNKALMAN_GOATCOUNTER_API_KEY: "k" }),
    ).toEqual({ baseUrl: "https://s.test", apiKey: "k", accessClientId: undefined, accessClientSecret: undefined });
    expect(trackerUrl({ ROWENNKALMAN_GOATCOUNTER_URL: " " })).toBeUndefined();
  });
  it("accepts the service token pasted as a whole header line", () => {
    const cfg = statsConfig({
      ROWENNKALMAN_GOATCOUNTER_URL: "https://s.test",
      ROWENNKALMAN_GOATCOUNTER_API_KEY: "k",
      ROWENNKALMAN_CF_ACCESS_CLIENT_ID: " CF-Access-Client-Id: 0123456789abcdef0123456789abcdef.access ",
      ROWENNKALMAN_CF_ACCESS_CLIENT_SECRET: "cf-access-client-secret:" + "a".repeat(64),
    })!;
    expect(cfg.accessClientId).toBe("0123456789abcdef0123456789abcdef.access");
    expect(accessTokenShape(cfg)).toEqual({ idSet: true, idLooksLikeId: true, secretSet: true });
  });
});

describe("fetchVisitStats", () => {
  const now = new Date("2026-10-15T10:20:00Z");

  it("sends the API key and the Access service token, with hour-aligned ranges", async () => {
    const { calls, impl } = fakeGoatCounter();
    const stats = await fetchVisitStats(cfg, now, impl);
    expect(stats).toEqual({
      allTime: 900,
      last30: 200,
      last7: 40,
      pages: [{ name: "/", count: 120 }, { name: "/portfolio", count: 50 }],
      referrers: [{ name: "(direct)", count: 80 }, { name: "instagram.com", count: 30 }],
      countries: [{ name: "United States", count: 150 }],
    });
    expect(calls).toHaveLength(6);
    for (const c of calls) {
      expect(c.headers).toMatchObject({ Authorization: "Bearer k", "CF-Access-Client-Id": "id", "CF-Access-Client-Secret": "sec" });
      expect(c.url.searchParams.get("end")).toBe("2026-10-15T11:00:00.000Z");
    }
    expect(calls.map((c) => c.url.searchParams.get("start"))).toContain("2026-09-15T11:00:00.000Z");
  });

  it("fails loudly on a non-200 (e.g. Access redirecting to its login page)", async () => {
    await expect(fetchVisitStats(cfg, now, fakeGoatCounter(302).impl)).rejects.toThrow(/HTTP 302/);
  });
});
