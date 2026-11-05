import { logEvent } from "@/lib/log";
import { sizeKey } from "@/lib/images/sizes";
import { warmPictureCdn } from "@/lib/images/warm";

jest.mock("@/lib/log", () => ({ logEvent: jest.fn() }));

const CDN = "https://img.rowennkalman.com";

describe("warmPictureCdn", () => {
  const originalEnv = process.env.ROWENNKALMAN_IMAGE_CDN_URL;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.mocked(logEvent).mockClear();
    process.env.ROWENNKALMAN_IMAGE_CDN_URL = CDN;
  });

  afterEach(() => {
    process.env.ROWENNKALMAN_IMAGE_CDN_URL = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it("skips when the CDN variable is unset", async () => {
    delete process.env.ROWENNKALMAN_IMAGE_CDN_URL;
    globalThis.fetch = jest.fn() as typeof fetch;
    await warmPictureCdn({ key: "art/x.jpg", width: 2000, height: 1500, alt: "", sizes: [640, 960] });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("requests the original and every size from the CDN base and stored keys only", async () => {
    const key = "art/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg";
    const sizes = [640, 960, 1280, 1920, 2400];
    const expected = [...sizes.map((w) => `${CDN}/${sizeKey(key, w)}`), `${CDN}/${key}`];
    const seen: string[] = [];
    const responses: Response[] = [];
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      const res = new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "X-Image-Cache": "MISS" } });
      responses.push(res);
      return res;
    }) as typeof fetch;

    await warmPictureCdn({ key, width: 3000, height: 2000, alt: "", sizes });

    expect(seen.sort()).toEqual(expected.sort());
    expect(responses.every((r) => r.bodyUsed)).toBe(true);
    expect(logEvent).toHaveBeenCalledWith(
      "warm",
      expect.objectContaining({ key, MISS: sizes.length + 1, ms: expect.any(Number) }),
    );
  });

  it("does not throw when a warm request fails", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new Error("timeout");
    }) as typeof fetch;
    await expect(warmPictureCdn({ key: "art/y.jpg", width: 900, height: 600, alt: "", sizes: [640] })).resolves.toBeUndefined();
    expect(logEvent).toHaveBeenCalledWith("warm", expect.objectContaining({ error: 2 }));
  });
});
