import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/store";
import { unauthorized } from "@/lib/auth/server";
import { handleSave, imageUrlsFor } from "@/lib/admin/handlers";

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
  const result = await handleSave(getStore(), body);
  if (result.changed) revalidatePath("/", "layout");
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
