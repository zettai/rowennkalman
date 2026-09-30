import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { SignJWT, jwtVerify, errors } from "jose";
import { issueSession, sessionSecret } from "./session";
import { safeNext } from "./login-next";
import { isEmailLike } from "@/lib/text";
import { withSenderName } from "@/lib/contact/mailer";
import { clientIp, createRateLimiter, type RateLimiter } from "@/lib/rate-limit";

/**
 * Email magic-link sign-in. Only addresses in ROWENNKALMAN_ADMIN_EMAILS can
 * sign in. A link is a signed token valid for 15 minutes; it is not strictly
 * single-use (that needs a used-token store; see docs/PLAN.md).
 */

export const LINK_TTL_SECONDS = 15 * 60;
const ISSUER = "rowennkalman-admin";
const AUDIENCE = "rowennkalman-login-link";

type Env = Record<string, string | undefined>;

// Per IP and per address, so one person can't flood an inbox and one IP can't probe many addresses.
export const linkIpLimiter: RateLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });
export const linkEmailLimiter: RateLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !isEmailLike(email)) return null;
  return email;
}

export function allowedEmails(env: Env = process.env): Set<string> {
  return new Set(
    (env.ROWENNKALMAN_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => normalizeEmail(e))
      .filter((e): e is string => e !== null),
  );
}

export async function issueLoginLinkToken(
  email: string,
  next: string,
  secret: Uint8Array = sessionSecret(),
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  return new SignJWT({ next })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(email)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + LINK_TTL_SECONDS)
    .sign(secret);
}

/** The address and destination in a valid link, or null (expired, forged, or no longer allowed). */
export async function verifyLoginLinkToken(
  token: string | null | undefined,
  deps: { secret?: Uint8Array; env?: Env; nowSeconds?: number } = {},
): Promise<{ email: string; next: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, deps.secret ?? sessionSecret(deps.env), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: deps.nowSeconds === undefined ? undefined : new Date(deps.nowSeconds * 1000),
    });
    const email = normalizeEmail(payload.sub);
    if (!email || !allowedEmails(deps.env).has(email)) return null;
    return { email, next: safeNext(payload.next) };
  } catch (err) {
    if (err instanceof errors.JOSEError || err instanceof TypeError) return null;
    throw err;
  }
}

export interface LinkMailer {
  sendLoginLink(to: string, url: string): Promise<void>;
}

/** Sends the link through the Resend HTTP API with plain fetch (no SDK). */
export class ResendLinkMailer implements LinkMailer {
  constructor(
    private readonly config: { apiKey: string; from: string },
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async sendLoginLink(to: string, url: string): Promise<void> {
    const res = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.config.from,
        to: [to],
        subject: "Your sign-in link for rowennkalman.com",
        text:
          `Hello,\n\nSomeone asked to sign in to edit rowennkalman.com with this email address. ` +
          `If that was you, open this link:\n\n${url}\n\n` +
          `The link works for 15 minutes. If you did not ask for it, you can ignore this email; nothing was changed.\n\n` +
          `Rowenn Beth Kalman, rowennkalman.com`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend answered ${res.status}`);
  }
}

/**
 * Development and tests: prints the link, and appends it to <data dir>/outbox/login-links.jsonl
 * so a local session or the e2e suite can follow it.
 */
export class ConsoleLinkMailer implements LinkMailer {
  constructor(private readonly dataDir: string) {}

  async sendLoginLink(to: string, url: string): Promise<void> {
    console.info(`[ConsoleLinkMailer] sign-in link for ${to}: ${url}`);
    const dir = path.join(this.dataDir, "outbox");
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, "login-links.jsonl"), JSON.stringify({ to, url, at: new Date().toISOString() }) + "\n");
  }
}

export function getLinkMailer(env: Env = process.env): LinkMailer {
  const apiKey = env.ROWENNKALMAN_RESEND_API_KEY?.trim();
  if (!apiKey) return new ConsoleLinkMailer(env.ROWENNKALMAN_DATA_DIR?.trim() || path.join(process.cwd(), ".data"));
  const from = env.ROWENNKALMAN_CONTACT_FROM?.trim();
  if (!from) throw new Error("ROWENNKALMAN_CONTACT_FROM must be set with the Resend key.");
  return new ResendLinkMailer({ apiKey, from: withSenderName(from) });
}

export type LinkRequestOutcome = { ok: true } | { ok: false; reason: "limited" | "invalid" };

/**
 * Asks for a sign-in link. The answer is the same whether or not the address may sign in,
 * so the form can't be used to find out who the editors are.
 */
export async function requestLoginLink(
  input: { email: unknown; next: unknown },
  headers: Headers,
  origin: string,
  deps: { mailer?: LinkMailer; env?: Env; ipLimiter?: RateLimiter; emailLimiter?: RateLimiter } = {},
): Promise<LinkRequestOutcome> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, reason: "invalid" };
  if (!(deps.ipLimiter ?? linkIpLimiter).hit(clientIp(headers)).allowed) return { ok: false, reason: "limited" };
  if (!(deps.emailLimiter ?? linkEmailLimiter).hit(email).allowed) return { ok: true };
  if (!allowedEmails(deps.env).has(email)) return { ok: true };
  const token = await issueLoginLinkToken(email, safeNext(input.next), sessionSecret(deps.env));
  const url = new URL("/api/auth/magic-link", origin);
  url.searchParams.set("token", token);
  await (deps.mailer ?? getLinkMailer(deps.env)).sendLoginLink(email, url.toString());
  return { ok: true };
}

/** Exchanges a valid link for a session token. */
export async function redeemLoginLink(
  token: string | null,
  deps: { env?: Env; nowSeconds?: number } = {},
): Promise<{ sessionToken: string; next: string } | null> {
  const link = await verifyLoginLinkToken(token, deps);
  if (!link) return null;
  const { token: sessionToken } = await issueSession({ subject: link.email, method: "magic-link" }, sessionSecret(deps.env));
  return { sessionToken, next: link.next };
}
