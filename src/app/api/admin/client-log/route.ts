import { getStore } from "@/lib/store";
import { unauthorized } from "@/lib/auth/server";
import { handleClientLog } from "@/lib/admin/handlers";

export const dynamic = "force-dynamic";

/** JSON: an upload failure seen only in the browser (see handleClientLog, docs/IMAGES.md). */
export async function POST(req: Request) {
  const denied = await unauthorized();
  if (denied) return denied;
  const raw = await req.json().catch(() => null);
  const result = await handleClientLog(getStore(), raw, req.headers);
  return result.status === 204 ? new Response(null, { status: 204 }) : Response.json(result.body, { status: result.status });
}
