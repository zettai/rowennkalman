import { handleContact } from "@/lib/contact/handler";
import { getMailer } from "@/lib/contact/mailer";

export const dynamic = "force-dynamic";

/** POST JSON { name, email, message, website, startedAt }. */
export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > 32 * 1024) {
    return Response.json({ ok: false, error: "The message is too long." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "The form was not filled in correctly." }, { status: 400 });
  }
  const result = await handleContact(body, req.headers, { mailer: getMailer() });
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
