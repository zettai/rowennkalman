"use client";

import { useState } from "react";
import s from "../admin.module.css";
import type { ListField } from "@/lib/content/fields";
import { TextFieldControl } from "./TextFieldControl";
import { move } from "./move";
import { useMoveFocus } from "./useMoveFocus";

type Item = { id: string } & Record<string, string>;

type Props = { field: ListField; id: string; value: Item[]; onChange: (next: Item[]) => void };

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}`;
}

/** An ordered list of small records (research documents). */
export function ListControl({ field, id, value, onChange }: Props) {
  const focus = useMoveFocus();
  const [confirming, setConfirming] = useState<string | null>(null);

  const add = () => {
    const item: Item = { id: newId() };
    for (const f of field.fields) item[f.path] = "";
    onChange([...value, item]);
    focus.announce(`${field.itemLabel} ${value.length + 1} added.`);
    requestAnimationFrame(() => document.getElementById(`${id}-${item.id}-${field.fields[0]!.path}`)?.focus());
  };

  return (
    <div className={s.field}>
      <p className={s.label} id={`${id}-label`}>
        {field.label}
      </p>
      <p className={s.hint}>{field.hint}</p>
      <ol className={s.imageList} aria-labelledby={`${id}-label`}>
        {value.map((item, i) => {
          const name = `${field.itemLabel} ${i + 1}`;
          return (
            <li key={item.id} className={s.imageListItem} data-item-id={item.id}>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className={s.label}>{name}</legend>
                {field.fields.map((f) => (
                  <TextFieldControl
                    key={f.path}
                    field={f}
                    id={`${id}-${item.id}-${f.path}`}
                    value={item[f.path] ?? ""}
                    onChange={(v) => onChange(value.map((it, j) => (j === i ? { ...it, [f.path]: v } : it)))}
                  />
                ))}
              </fieldset>
              <div className={s.row} style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className={s.buttonSecondary}
                  data-action="up"
                  disabled={i === 0}
                  aria-label={`Move ${name} up`}
                  onClick={() => {
                    onChange(move(value, i, -1));
                    focus.moved(item.id, "up", name, i, value.length);
                  }}
                >
                  ↑ Up
                </button>
                <button
                  type="button"
                  className={s.buttonSecondary}
                  data-action="down"
                  disabled={i === value.length - 1}
                  aria-label={`Move ${name} down`}
                  onClick={() => {
                    onChange(move(value, i, 1));
                    focus.moved(item.id, "down", name, i + 2, value.length);
                  }}
                >
                  ↓ Down
                </button>
                {confirming === item.id ? (
                  <div className={s.confirm} role="group" aria-label={`Confirm removing ${name}`}>
                    <p>Remove {name}? It disappears from the site when you save.</p>
                    <div className={s.row}>
                      <button
                        type="button"
                        className={s.buttonDanger}
                        onClick={() => {
                          setConfirming(null);
                          onChange(value.filter((_, j) => j !== i));
                          focus.announce(`${name} removed.`);
                        }}
                      >
                        Yes, remove
                      </button>
                      <button type="button" className={s.buttonSecondary} onClick={() => setConfirming(null)} autoFocus>
                        Keep it
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className={s.buttonQuiet} onClick={() => setConfirming(item.id)}>
                    Remove…
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <span className={s.visuallyHidden} aria-live="polite">
        {focus.announcement}
      </span>
      <div className={s.field}>
        <button type="button" className={s.buttonSecondary} onClick={add}>
          + {field.addLabel}
        </button>
      </div>
    </div>
  );
}
