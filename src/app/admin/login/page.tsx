import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import s from "../admin.module.css";
import { getSession } from "@/lib/auth/server";
import { safeNext } from "@/lib/auth/login-next";

export const metadata: Metadata = { title: "Sign in · Site editor" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; next?: string; signedOut?: string; sent?: string }> };

const ERRORS: Record<string, string> = {
  invalid: "That doesn't look like an email address. Check it and try again.",
  limited: "Too many tries. Please wait 15 minutes, then ask for a new link.",
  expired: "That sign-in link has expired or doesn't work any more. Ask for a new one below.",
  mail: "The email could not be sent just now. Please try again in a few minutes.",
};

export default async function LoginPage({ searchParams }: Props) {
  const { error, next, signedOut, sent } = await searchParams;
  if (await getSession().catch(() => null)) redirect(safeNext(next));
  const message = error ? (ERRORS[error] ?? ERRORS.invalid) : null;

  return (
    <main className={s.loginWrap}>
      <div className={s.loginCard}>
        <h1 className={s.h1}>Sign in to edit your site</h1>
        {sent && !message ? (
          <>
            <p className={s.noticeOk} role="status">
              Check your email. If this address can edit the site, a sign-in link is on its way. It works for 15 minutes.
            </p>
            <p className={s.lead}>
              No email after a few minutes? Look in your spam folder, or <Link href="/admin/login">ask for a new link</Link>.
            </p>
          </>
        ) : (
          <>
            <p className={s.lead}>Enter your email address and we&apos;ll send you a link to sign in. No password needed.</p>
            {signedOut && !message && (
              <p className={s.noticeOk} role="status">
                You are signed out.
              </p>
            )}
            {message && (
              <p className={s.noticeError} role="alert" id="login-error">
                {message}
              </p>
            )}
            <form action="/api/auth/login" method="post">
              <input type="hidden" name="next" value={safeNext(next)} />
              <div className={s.field}>
                <label className={s.label} htmlFor="email">
                  Email address
                </label>
                <input
                  className={s.input}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  aria-describedby={message ? "login-error" : undefined}
                />
              </div>
              <div className={s.field}>
                <button type="submit" className={s.button} style={{ width: "100%" }}>
                  Email me a sign-in link
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
