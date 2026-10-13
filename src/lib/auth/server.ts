import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type Session } from "./session";

/** The current admin session from the request cookie, or null. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/** For admin pages: redirect to the login screen without a session (proxy does this too). */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** For admin API routes: a 401 response without a session, otherwise null. */
export async function unauthorized(): Promise<Response | null> {
  return (await getSession()) ? null : Response.json({ error: "unauthorized" }, { status: 401 });
}
