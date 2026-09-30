import { NextResponse } from "next/server";
import { redeemLoginLink } from "@/lib/auth/magic-link";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

/** The link from the sign-in email: a valid token becomes a session cookie. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const result = await redeemLoginLink(url.searchParams.get("token"));
  if (!result) return NextResponse.redirect(new URL("/admin/login?error=expired", url), 303);
  const res = NextResponse.redirect(new URL(result.next, url), 303);
  res.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
