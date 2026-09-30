import { clientIp, createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import { checkContact } from "./validate";
import type { Mailer } from "./mailer";

// 5 messages per IP per 10 minutes. Best effort; see rate-limit.ts.
export const contactLimiter: RateLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

export type ContactResult = { status: number; body: { ok: boolean; error?: string; field?: string } };

export async function handleContact(
  raw: unknown,
  headers: Headers,
  deps: { mailer: Mailer; limiter?: RateLimiter; now?: number },
): Promise<ContactResult> {
  const limiter = deps.limiter ?? contactLimiter;
  const gate = limiter.hit(clientIp(headers));
  if (!gate.allowed) {
    return { status: 429, body: { ok: false, error: "Too many messages. Please try again a little later." } };
  }
  const check = checkContact(raw, deps.now ?? Date.now());
  // Honeypot filled: pretend it worked so the bot learns nothing. Send nothing.
  if (check.kind === "honeypot") return { status: 200, body: { ok: true } };
  if (check.kind === "invalid") return { status: 400, body: { ok: false, error: check.error, field: check.field } };
  try {
    await deps.mailer.send(check.message);
  } catch (err) {
    console.error("Contact message could not be sent", err);
    return { status: 502, body: { ok: false, error: "The message could not be sent." } };
  }
  return { status: 200, body: { ok: true } };
}
