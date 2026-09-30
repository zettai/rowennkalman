import { NextResponse } from "next/server";
import { requestLoginLink } from "@/lib/auth/magic-link";

/**
 * Plain HTML form POST (works without JavaScript): asks for a sign-in link by email,
 * then redirects back to the login page, which says to check the inbox.
 */
export async function POST(req: Request) {
  let email: unknown;
  let next: unknown;
  try {
    const form = await req.formData();
    email = form.get("email");
    next = form.get("next");
  } catch {
    email = undefined;
  }
  // Links point at the site's public address, never at a Host header a visitor sent.
  const origin = process.env.ROWENNKALMAN_SITE_URL?.trim() || process.env.URL?.trim() || new URL(req.url).origin;
  const url = new URL("/admin/login", req.url);
  try {
    const outcome = await requestLoginLink({ email, next }, req.headers, origin);
    url.searchParams.set(outcome.ok ? "sent" : "error", outcome.ok ? "1" : outcome.reason);
  } catch (err) {
    console.error("Sign-in link could not be sent:", err instanceof Error ? err.message : err);
    url.searchParams.set("error", "mail");
  }
  return NextResponse.redirect(url, 303);
}
