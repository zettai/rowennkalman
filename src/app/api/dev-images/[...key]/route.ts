import { FileStore, getStore } from "@/lib/store";

/**
 * Serves FileStore images. Only active while FileStore is the store (no S3 env);
 * with S3 configured, images come from ROWENNKALMAN_PUBLIC_IMAGE_BASE and this 404s.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const store = getStore();
  if (!(store instanceof FileStore)) return new Response("Not found", { status: 404 });
  const key = (await ctx.params).key.join("/");
  let bytes: Uint8Array | null = null;
  try {
    bytes = await store.readImage(key);
  } catch {
    bytes = null; // invalid key
  }
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
