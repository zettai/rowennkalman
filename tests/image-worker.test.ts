import worker from "./helpers/image-worker-entry.js";

type WorkerEnv = {
  ORIGIN: string;
  ART?: {
    get: jest.Mock;
    put: jest.Mock;
  };
};

function r2Body(bytes: Uint8Array) {
  return new Response(bytes.slice()).body;
}

describe("image Worker", () => {
  const ORIGIN = "https://origin.test";
  let cacheStore: Map<string, Response>;
  let cacheMatch: jest.Mock;
  let cachePut: jest.Mock;
  let fetchMock: jest.Mock;
  let waitUntilTasks: Promise<unknown>[];
  let env: WorkerEnv;
  let ctx: { waitUntil: (p: Promise<unknown>) => void };
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    cacheStore = new Map();
    cacheMatch = jest.fn(async (req: Request) => cacheStore.get(req.url) ?? undefined);
    cachePut = jest.fn(async (req: Request, res: Response) => {
      cacheStore.set(req.url, res.clone());
    });
    (globalThis as unknown as { caches: { default: { match: typeof cacheMatch; put: typeof cachePut } } }).caches = {
      default: { match: cacheMatch, put: cachePut },
    };

    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    waitUntilTasks = [];
    ctx = {
      waitUntil: (p) => {
        waitUntilTasks.push(p);
      },
    };

    env = {
      ORIGIN,
      ART: {
        get: jest.fn(),
        put: jest.fn(),
      },
    };

    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  async function run(path: string, init: RequestInit = {}) {
    const req = new Request(`https://img.test${path}`, init);
    const res = await worker.fetch(req, env, ctx);
    await Promise.all(waitUntilTasks);
    return res;
  }

  it("serves a cache HIT without R2 or origin fetch", async () => {
    const cached = new Response("cached", { status: 200, headers: { "Content-Type": "image/jpeg" } });
    cacheStore.set("https://img.test/art/pic.jpg", cached);
    const res = await run("/art/pic.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Image-Cache")).toBe("HIT");
    expect(env.ART!.get).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves from R2 with X-Image-Cache R2 and does not fetch Paris", async () => {
    env.ART!.get.mockResolvedValue({
      body: r2Body(new Uint8Array([1, 2, 3])),
      httpMetadata: { contentType: "image/webp" },
      httpEtag: '"r2"',
    });
    const res = await run("/art/pic-640.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Image-Cache")).toBe("R2");
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cachePut).toHaveBeenCalled();
    expect(env.ART!.put).not.toHaveBeenCalled();
  });

  it("falls back to Paris on MISS, stores in R2 and cache, and sets Content-Type for jpg", async () => {
    env.ART!.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([9, 9]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg", ETag: '"o"' },
      }),
    );
    env.ART!.put.mockResolvedValue(undefined);
    const res = await run("/art/pic.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Image-Cache")).toBe("MISS");
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(fetchMock).toHaveBeenCalledWith(`${ORIGIN}/art/pic.jpg`);
    expect(env.ART!.put).toHaveBeenCalledWith(
      "art/pic.jpg",
      expect.any(ArrayBuffer),
      expect.objectContaining({ httpMetadata: { contentType: "image/jpeg" } }),
    );
    expect(cachePut).toHaveBeenCalled();
  });

  it("falls through to Paris when R2 get throws", async () => {
    env.ART!.get.mockRejectedValue(new Error("r2 down"));
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1]), { status: 200, headers: { "Content-Type": "image/jpeg" } }));
    const res = await run("/art/pic.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Image-Cache")).toBe("MISS");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("still returns 200 when R2 put throws", async () => {
    env.ART!.get.mockResolvedValue(null);
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1]), { status: 200, headers: { "Content-Type": "image/jpeg" } }));
    env.ART!.put.mockRejectedValue(new Error("put failed"));
    const res = await run("/art/pic.jpg");
    expect(res.status).toBe(200);
    expect(errorSpy).toHaveBeenCalledWith("R2 put failed", expect.any(Error));
  });

  it("maps origin 403 to 404 and origin 500 to 502", async () => {
    env.ART!.get.mockResolvedValue(null);
    fetchMock.mockResolvedValueOnce(new Response("", { status: 403 }));
    expect((await run("/art/missing.jpg")).status).toBe(404);
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    expect((await run("/art/broken.jpg")).status).toBe(502);
  });

  it("returns 404 for paths outside art pictures and 405 for POST", async () => {
    expect((await run("/content.json")).status).toBe(404);
    expect((await run("/art/pic.jpg", { method: "POST" })).status).toBe(405);
  });

  it("HEAD returns headers without a body", async () => {
    env.ART!.get.mockResolvedValue({
      body: r2Body(new Uint8Array([1])),
      httpMetadata: { contentType: "image/webp" },
      httpEtag: '"h"',
    });
    const res = await run("/art/pic-640.webp", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Image-Cache")).toBe("R2");
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBe(0);
  });

  it("infers image/webp Content-Type from the path when R2 metadata is missing", async () => {
    env.ART!.get.mockResolvedValue({
      body: r2Body(new Uint8Array([1])),
      httpMetadata: {},
      httpEtag: '"w"',
    });
    const res = await run("/art/pic-960.webp");
    expect(res.headers.get("Content-Type")).toBe("image/webp");
  });
});
