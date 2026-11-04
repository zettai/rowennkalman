/**
 * img.rowennkalman.com (and, until it is retired, img.tomas-tello.stream): serves the site's pictures from the Scaleway bucket through
 * Cloudflare's cache, so a visitor gets them from a nearby Cloudflare location instead of
 * from Paris every time. See docs/IMAGES.md.
 *
 * Only picture files under art/ are served; everything else (content.json, logs/) is a 404
 * here even though the bucket itself also refuses it.
 *
 * On a cache miss the Worker reads a copy from R2 (Western North America) before falling back to
 * the Scaleway bucket in Paris; a Paris fetch back-fills R2 for the next miss elsewhere.
 */
const PICTURE = /^\/art\/[A-Za-z0-9-]+\.(webp|jpg)$/;
const YEAR = 31536000;

function contentTypeForPath(pathname, fallback) {
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".jpg")) return "image/jpeg";
  return fallback ?? "application/octet-stream";
}

function pictureHeaders(contentType, etag) {
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": `public, max-age=${YEAR}, immutable`,
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
  });
  if (etag) headers.set("ETag", etag);
  return headers;
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    if (!PICTURE.test(url.pathname)) return new Response("Not found", { status: 404 });

    // One cache entry per picture, whatever query string a visitor adds.
    const key = new Request(`${url.origin}${url.pathname}`, { method: "GET" });
    const cache = caches.default;
    let response = await cache.match(key);
    let state = "HIT";
    if (!response) {
      const objectKey = url.pathname.slice(1);
      let r2Object = null;
      try {
        if (env.ART) r2Object = await env.ART.get(objectKey);
      } catch (err) {
        console.error("R2 get failed", err);
      }
      if (r2Object) {
        state = "R2";
        const contentType = r2Object.httpMetadata?.contentType ?? contentTypeForPath(url.pathname);
        const headers = pictureHeaders(contentType, r2Object.httpEtag ?? r2Object.etag);
        response = new Response(r2Object.body, { status: 200, headers });
        ctx.waitUntil(cache.put(key, response.clone()));
      } else {
        state = "MISS";
        const origin = await fetch(`${env.ORIGIN}${url.pathname}`);
        if (!origin.ok) {
          // The bucket answers 403 for a missing public object; to a visitor that is a 404.
          const status = origin.status === 403 || origin.status === 404 ? 404 : 502;
          return new Response(status === 404 ? "Not found" : "Upstream error", { status });
        }
        const body = await origin.arrayBuffer();
        const contentType = origin.headers.get("Content-Type") ?? contentTypeForPath(url.pathname);
        const etag = origin.headers.get("ETag");
        const headers = pictureHeaders(contentType, etag);
        response = new Response(body, { status: 200, headers });
        ctx.waitUntil(
          (async () => {
            try {
              if (env.ART) {
                await env.ART.put(objectKey, body, { httpMetadata: { contentType } });
              }
            } catch (err) {
              console.error("R2 put failed", err);
            }
            await cache.put(key, response.clone());
          })(),
        );
      }
    }
    const out = new Response(request.method === "HEAD" ? null : response.body, response);
    out.headers.set("X-Image-Cache", state);
    return out;
  },
};

export default worker;
