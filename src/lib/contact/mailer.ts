import type { ContactMessage } from "./validate";

export interface Mailer {
  send(message: ContactMessage): Promise<void>;
}

export class MailerError extends Error {}

/** "web@example.com" becomes "Rowenn Beth Kalman <web@example.com>"; a value that already has a name is kept. */
export function withSenderName(from: string, name = "Rowenn Beth Kalman"): string {
  return from.includes("<") ? from : `${name} <${from}>`;
}

const RESEND_URL = "https://api.resend.com/emails";

function subjectFor(m: ContactMessage) {
  return `Website message from ${m.name}`.replace(/[\r\n]+/g, " ").slice(0, 150);
}

/** Sends through the Resend HTTP API with plain fetch (no SDK). */
export class ResendMailer implements Mailer {
  constructor(
    private readonly config: { apiKey: string; to: string; from: string },
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async send(m: ContactMessage): Promise<void> {
    const res = await this.fetchImpl(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.config.from,
        to: [this.config.to],
        reply_to: m.email,
        subject: subjectFor(m),
        text: `${m.message}\n\n-- \n${m.name} <${m.email}>\nSent from the website contact form.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new MailerError(`Resend answered ${res.status}: ${detail.slice(0, 300)}`);
    }
  }
}

/** Development fallback: prints the message instead of sending it. */
export class ConsoleMailer implements Mailer {
  async send(m: ContactMessage): Promise<void> {
    console.info(`[ConsoleMailer] ${subjectFor(m)} <${m.email}>\n${m.message}`);
  }
}

export function getMailer(env: Record<string, string | undefined> = process.env): Mailer {
  const apiKey = env.ROWENNKALMAN_RESEND_API_KEY?.trim();
  if (!apiKey) return new ConsoleMailer();
  const to = env.ROWENNKALMAN_CONTACT_TO?.trim();
  const from = env.ROWENNKALMAN_CONTACT_FROM?.trim();
  if (!to || !from) throw new MailerError("ROWENNKALMAN_CONTACT_TO and ROWENNKALMAN_CONTACT_FROM must be set with the Resend key.");
  return new ResendMailer({ apiKey, to, from: withSenderName(from) });
}
