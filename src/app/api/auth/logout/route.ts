import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/admin/login?signedOut=1", req.url), 303);
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}
