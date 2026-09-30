import { redeemLoginLink } from "@/lib/auth/magic-link";
import { seeOther } from "@/lib/auth/redirect";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

/** The link from the sign-in email: a valid token becomes a session cookie. */
export async function GET(req: Request) {
  const result = await redeemLoginLink(new URL(req.url).searchParams.get("token"));
  if (!result) return seeOther("/admin/login?error=expired");
  const res = seeOther(result.next);
  res.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
