import { SignJWT, jwtVerify, errors } from "jose";

/**
 * Session issue/verify, the only place that knows what a session is.
 * Edge-safe (jose only), so proxy.ts can use it.
 *
 * Sessions come from the email magic link (magic-link.ts), which proves the
 * address and then calls issueSession({ method: "magic-link" }); proxy,
 * pages and API routes call verifySession.
 */

export const SESSION_COOKIE = "rk_admin_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const ISSUER = "rowennkalman-admin";
const AUDIENCE = "rowennkalman-admin";

export type LoginMethod = "magic-link";
export type Session = { subject: string; method: LoginMethod; issuedAt: number; expiresAt: number };

export class AuthConfigError extends Error {}

export function sessionSecret(env: Record<string, string | undefined> = process.env): Uint8Array {
  const secret = env.ROWENNKALMAN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new AuthConfigError("ROWENNKALMAN_SESSION_SECRET must be set to at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function issueSession(
  input: { subject?: string; method: LoginMethod },
  secret: Uint8Array = sessionSecret(),
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<{ token: string; session: Session }> {
  const session: Session = {
    subject: input.subject ?? "editor",
    method: input.method,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + SESSION_TTL_SECONDS,
  };
  const token = await new SignJWT({ method: session.method })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(session.subject)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(session.issuedAt)
    .setExpirationTime(session.expiresAt)
    .sign(secret);
  return { token, session };
}

/** Returns the session, or null for a missing, forged, expired or malformed token. */
export async function verifySession(
  token: string | undefined | null,
  secret: Uint8Array = sessionSecret(),
  nowSeconds?: number,
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: nowSeconds === undefined ? undefined : new Date(nowSeconds * 1000),
    });
    const method = payload.method;
    if (typeof payload.sub !== "string" || method !== "magic-link") return null;
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;
    return { subject: payload.sub, method, issuedAt: payload.iat, expiresAt: payload.exp };
  } catch (err) {
    if (err instanceof errors.JOSEError || err instanceof TypeError) return null;
    throw err;
  }
}

/** Cookie attributes for the session cookie (httpOnly, Secure, SameSite=Lax, 7 days). */
export function sessionCookieOptions(maxAge: number = SESSION_TTL_SECONDS) {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge };
}
