import { unauthorized } from "@/lib/auth/server";
import { siteRefreshLimiter } from "@/lib/admin/handlers";
import { clientIp } from "@/lib/rate-limit";
import { purgePublicPages } from "@/lib/cdn";
import { refreshPublicPages } from "@/lib/page-refresh";

export const dynamic = "force-dynamic";

/** Purges the public page cache tag and warms each page (signed-in retry when purge failed on save). */
export async function POST(req: Request) {
  const denied = await unauthorized();
  if (denied) return denied;
  if (!siteRefreshLimiter.hit(clientIp(req.headers)).allowed) {
    return Response.json({ error: "rate-limited" }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  const purge = await purgePublicPages();
  const refresh = purge === "purged" ? await refreshPublicPages("retry") : {};
  return Response.json({ purge, refresh }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return Response.json({ error: "method-not-allowed" }, { status: 405, headers: { "Cache-Control": "no-store" } });
}
