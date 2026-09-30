import { seeOther } from "@/lib/auth/redirect";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const res = seeOther("/admin/login?signedOut=1");
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}
