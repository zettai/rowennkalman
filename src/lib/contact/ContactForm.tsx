"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Content } from "@/lib/content/schema";
import { CONTACT_LIMITS } from "./limits";

type Labels = Content["contact"]["form"];

type Props = {
  labels: Labels;
  /** Defaults to /api/contact. */
  endpoint?: string;
  className?: string;
};

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; detail?: string };

/**
 * Unstyled contact form. Style it from outside with className and the
 * data-part attributes (field, label, input, textarea, submit, status).
 * Includes a hidden honeypot field ("website") and the startedAt timestamp.
 */
export function ContactForm({ labels, endpoint = "/api/contact", className }: Props) {
  const id = useId();
  const startedAt = useRef<number>(0);
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setState({ kind: "sending" });
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          message: String(data.get("message") ?? ""),
          website: String(data.get("website") ?? ""),
          startedAt: startedAt.current || Date.now(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && body.ok) {
        setState({ kind: "sent" });
        form.reset();
      } else {
        setState({ kind: "error", detail: res.status === 400 ? body.error : undefined });
      }
    } catch {
      setState({ kind: "error" });
    }
  }

  return (
    <form className={className} onSubmit={onSubmit} data-state={state.kind}>
      <div data-part="field">
        <label data-part="label" htmlFor={`${id}-name`}>
          {labels.nameLabel}
        </label>
        <input data-part="input" id={`${id}-name`} name="name" autoComplete="name" required maxLength={CONTACT_LIMITS.name} />
      </div>
      <div data-part="field">
        <label data-part="label" htmlFor={`${id}-email`}>
          {labels.emailLabel}
        </label>
        <input
          data-part="input"
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={CONTACT_LIMITS.email}
        />
      </div>
      <div data-part="field">
        <label data-part="label" htmlFor={`${id}-message`}>
          {labels.messageLabel}
        </label>
        <textarea data-part="textarea" id={`${id}-message`} name="message" rows={6} required maxLength={CONTACT_LIMITS.message} />
      </div>
      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <button data-part="submit" type="submit" disabled={state.kind === "sending"}>
        {labels.submitLabel}
      </button>
      <div data-part="status" role="status" aria-live="polite">
        {state.kind === "sent" && <p>{labels.successMessage}</p>}
        {state.kind === "error" && (
          <p role="alert">
            {labels.errorMessage}
            {state.detail ? ` ${state.detail}` : ""}
          </p>
        )}
      </div>
    </form>
  );
}
