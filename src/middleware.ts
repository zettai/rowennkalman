import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession, sessionSecret, AuthConfigError } from "@/lib/auth/session";

/**
 * Guards /admin/** (except the login page) and /api/admin/**.
 * Pages redirect to the login screen; API routes answer 401 JSON.
 * Admin pages and API routes check the session again themselves.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith("/api/admin");
  if (pathname === "/admin/login") return NextResponse.next();

  // Writes must come from our own origin (defence in depth on top of SameSite=Lax).
  if (isApi && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin && !sameHost(origin, req.headers.get("host") ?? req.nextUrl.host)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  let session = null;
  try {
    session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, sessionSecret());
  } catch (err) {
    if (!(err instanceof AuthConfigError)) throw err;
    console.error(err.message);
  }
  if (session) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }

  if (isApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const login = new URL("/admin/login", req.url);
  if (pathname !== "/admin") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

function sameHost(origin: string, host: string): boolean {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
