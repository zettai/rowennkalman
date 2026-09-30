"use client";

import s from "../admin.module.css";
import type { TextField } from "@/lib/content/fields";

export function fieldId(path: string) {
  return `f-${path.replace(/[^A-Za-z0-9]+/g, "-")}`;
}

type Props = { field: TextField; id: string; value: string; onChange: (v: string) => void };

export function TextFieldControl({ field, id, value, onChange }: Readonly<Props>) {
  const hintId = `${id}-hint`;
  const over = field.maxLength !== undefined && value.length > field.maxLength;
  const urlProblem = field.kind === "url" && value.trim() !== "" && !/^(https?:\/\/|mailto:|\/)/i.test(value.trim());
  const common = {
    id,
    name: id,
    value,
    "aria-describedby": hintId + (urlProblem ? ` ${id}-err` : ""),
    "aria-invalid": urlProblem || undefined,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {field.label}
      </label>
      <span className={s.hint} id={hintId}>
        {field.hint}
      </span>
      {field.kind === "textarea" ? (
        <textarea className={s.textarea} rows={Math.min(14, Math.max(4, value.split("\n").length + 1))} {...common} />
      ) : (
        <input
          className={s.input}
          type={field.kind === "url" ? "url" : "text"}
          inputMode={field.kind === "url" ? "url" : undefined}
          autoComplete="off"
          {...common}
        />
      )}
      {field.maxLength !== undefined && (
        <span className={`${s.counter} ${over ? s.counterOver : ""}`}>
          {value.length} / {field.maxLength} characters{over ? " (a bit long; it may be cut short in some places)" : ""}
        </span>
      )}
      {urlProblem && (
        <p className={s.fieldError} id={`${id}-err`}>
          Web addresses usually start with https://
        </p>
      )}
    </div>
  );
}
