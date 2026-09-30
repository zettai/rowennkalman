/**
 * Best-effort fixed-window rate limiter, in memory.
 *
 * Serverless caveat: each function instance has its own memory and instances
 * come and go, so this slows down a single client hammering one instance but
 * is not a hard global limit. For that, back it with a shared store (e.g. a
 * Netlify Blobs or Redis counter) behind the same interface.
 */
export type RateLimiter = {
  /** Records a hit and says whether it is allowed. */
  hit(key: string): { allowed: boolean; retryAfterSeconds: number };
  reset(key: string): void;
};

export function createRateLimiter(options: { limit: number; windowMs: number; now?: () => number; maxKeys?: number }): RateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 10_000;
  const buckets = new Map<string, { count: number; start: number }>();

  return {
    hit(key) {
      const t = now();
      let b = buckets.get(key);
      if (!b || t - b.start >= windowMs) {
        if (buckets.size >= maxKeys) {
          // Drop expired windows; if still full, drop the oldest entry.
          for (const [k, v] of buckets) if (t - v.start >= windowMs) buckets.delete(k);
          if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value as string);
        }
        b = { count: 0, start: t };
        buckets.set(key, b);
      }
      b.count += 1;
      const allowed = b.count <= limit;
      return { allowed, retryAfterSeconds: allowed ? 0 : Math.ceil((b.start + windowMs - t) / 1000) };
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}

/** Client IP for rate limiting. Netlify sets x-nf-client-connection-ip; otherwise the first x-forwarded-for hop. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-nf-client-connection-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
