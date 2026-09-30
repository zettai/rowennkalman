import { seeOther } from "@/lib/auth/redirect";
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
  const params = new URLSearchParams();
  try {
    const outcome = await requestLoginLink({ email, next }, req.headers, origin);
    params.set(outcome.ok ? "sent" : "error", outcome.ok ? "1" : outcome.reason);
  } catch (err) {
    console.error("Sign-in link could not be sent:", err instanceof Error ? err.message : err);
    params.set("error", "mail");
  }
  return seeOther(`/admin/login?${params}`);
}
