import { z } from "zod";

import { CONTACT_LIMITS } from "./limits";
import { isEmailLike } from "@/lib/text";

export { CONTACT_LIMITS };
/** Humans take longer than this to fill in the form; bots usually don't. */
export const MIN_FILL_MS = 3000;


const ContactBody = z.object({
  name: z.string(),
  email: z.string(),
  message: z.string(),
  website: z.string().optional().default(""),
  startedAt: z.number(), // finite by default in zod 4
});

export type ContactMessage = { name: string; email: string; message: string };

export type ContactCheck =
  | { kind: "ok"; message: ContactMessage }
  | { kind: "honeypot" }
  | { kind: "invalid"; error: string; field?: keyof ContactMessage | "startedAt" };

/** Strip control characters (except newlines in the message) and trim. */
function clean(s: string, allowNewlines: boolean): string {
  const noCtrl = allowNewlines ? s.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, "") : s.replace(/[\u0000-\u001F\u007F]/g, " ");
  return noCtrl.trim();
}

export function checkContact(raw: unknown, now: number): ContactCheck {
  const parsed = ContactBody.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", error: "The form was not filled in correctly." };
  const { website, startedAt } = parsed.data;
  if (website.trim() !== "") return { kind: "honeypot" };
  if (now - startedAt < MIN_FILL_MS) {
    return { kind: "invalid", error: "That was very quick. Please wait a moment and send again.", field: "startedAt" };
  }
  const name = clean(parsed.data.name, false);
  const email = clean(parsed.data.email, false);
  const message = clean(parsed.data.message, true);
  if (!name) return { kind: "invalid", error: "Please enter your name.", field: "name" };
  if (name.length > CONTACT_LIMITS.name) return { kind: "invalid", error: "Your name is too long.", field: "name" };
  if (email.length > CONTACT_LIMITS.email || !isEmailLike(email, { strict: true })) {
    return { kind: "invalid", error: "Please enter a valid email address.", field: "email" };
  }
  if (message.length < 2) return { kind: "invalid", error: "Please write a message.", field: "message" };
  if (message.length > CONTACT_LIMITS.message) {
    return { kind: "invalid", error: `Your message is too long (at most ${CONTACT_LIMITS.message} characters).`, field: "message" };
  }
  return { kind: "ok", message: { name, email, message } };
}
