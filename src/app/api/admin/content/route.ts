import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getStore } from "@/lib/store";
import { getSession, unauthorized } from "@/lib/auth/server";
import { changedPaths, logEvent } from "@/lib/log";
import { purgePublicPages } from "@/lib/cdn";
import { handleSave, imageUrlsFor, sweepAbandonedUploads } from "@/lib/admin/handlers";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await unauthorized();
  if (denied) return denied;
  const store = getStore();
  const content = await store.getContent();
  return Response.json({ content, imageUrls: imageUrlsFor(store, content) }, { headers: { "Cache-Control": "no-store" } });
}

/** Body: { page, value, expectedUpdatedAt }. Replaces one page's content. */
export async function PUT(req: Request) {
  const denied = await unauthorized();
  if (denied) return denied;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid", message: "The request was not understood." }, { status: 400 });
  }
  const started = Date.now();
  const store = getStore();
  const result = await handleSave(store, body);
  let purge: string | null = null;
  if (result.changed) {
    revalidatePath("/", "layout");
    purge = await purgePublicPages();
    // After the response: the editor doesn't wait for it, and a skipped run is caught by the next save.
    after(async () => {
      const t = Date.now();
      const swept = await sweepAbandonedUploads(store);
      logEvent("sweep", { removed: swept.length, ms: Date.now() - t });
    });
  }
  const page = (body as { page?: unknown } | null)?.page;
  const saved = (result.body as { content?: { updatedAt: string } }).content;
  logEvent("save", {
    editor: (await getSession())?.subject ?? null,
    page: typeof page === "string" ? page : null,
    status: result.status,
    changed:
      result.previous !== undefined && saved && typeof page === "string"
        ? changedPaths(result.previous, (saved as Record<string, unknown>)[page], page).slice(0, 40)
        : [],
    from: (body as { expectedUpdatedAt?: unknown } | null)?.expectedUpdatedAt ?? null,
    to: saved?.updatedAt ?? null,
    purge,
    ms: Date.now() - started,
  });
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
