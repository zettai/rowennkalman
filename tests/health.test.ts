import { GET, POST } from "@/app/api/health/route";

describe("/api/health", () => {
  it("GET returns 200 with status ok and Cache-Control no-store", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("POST returns 405 with a short message", async () => {
    const res = await POST();
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ message: "Health check endpoint supports GET requests only" });
  });
});
