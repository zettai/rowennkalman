"use client";

import { useRef, useState } from "react";
import type { Content } from "./content";

type Labels = Content["contact"]["form"];
type Status = "idle" | "sending" | "sent" | "error";

// Posts the contract shape from the admin request: { name, email, message, website, startedAt }.
export function ContactForm({ labels }: { labels: Labels }) {
  const startedAt = useRef(Date.now());
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          message: form.get("message"),
          website: form.get("website"),
          startedAt: startedAt.current,
        }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p className="form-status" role="status">
        {labels.successMessage}
      </p>
    );
  }

  return (
    <form className="contact-form" onSubmit={onSubmit}>
      <label>
        <span>
          {labels.nameLabel} <em>(required)</em>
        </span>
        <input name="name" autoComplete="name" required maxLength={200} />
      </label>
      <label>
        <span>
          {labels.emailLabel} <em>(required)</em>
        </span>
        <input name="email" type="email" autoComplete="email" required maxLength={320} />
      </label>
      <label>
        <span>
          {labels.messageLabel} <em>(required)</em>
        </span>
        <textarea name="message" rows={5} required maxLength={5000} />
      </label>
      {/* Honeypot: hidden from people, filled in by bots. */}
      <label className="hp" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <button type="submit" className="button" disabled={status === "sending"}>
        {labels.submitLabel}
      </button>
      {status === "error" && (
        <p className="form-status" role="alert">
          {labels.errorMessage}
        </p>
      )}
    </form>
  );
}
