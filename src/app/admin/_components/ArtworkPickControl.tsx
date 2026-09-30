"use client";

import s from "../admin.module.css";
import type { ArtworkPickField } from "@/lib/content/fields";
import { artworkName, type ArtworkOption } from "./ArtworkChooser";

type Props = {
  field: ArtworkPickField;
  id: string;
  value: string[];
  artworks: ArtworkOption[];
  urls: Record<string, string>;
  onChange: (next: string[]) => void;
};

/** Choose up to `field.max` paintings from the portfolio; the order of clicks is the order shown. */
export function ArtworkPickControl({ field, id, value, artworks, urls, onChange }: Readonly<Props>) {
  // Ids of paintings deleted from the portfolio are dropped here, so saving cleans them up.
  const chosen = value.filter((v) => artworks.some((a) => a.id === v));
  const full = chosen.length >= field.max;
  let summary = "No paintings chosen: nothing is shown under the top of the home page.";
  if (chosen.length > 0) summary = `${chosen.length} of ${field.max} chosen.` + (full ? " Take one out to choose another." : "");
  return (
    <fieldset className={`${s.field} ${s.fs}`} aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`}>
      <span className={s.label} id={`${id}-label`}>
        {field.label}
      </span>
      <span className={s.hint} id={`${id}-hint`}>
        {field.hint} Click a painting again to take it out.
      </span>
      {artworks.length === 0 ? (
        <p className={s.hint}>Add paintings to your portfolio first.</p>
      ) : (
        <ul className={s.chooserGrid}>
          {artworks.map((a, i) => {
            const pos = chosen.indexOf(a.id);
            const on = pos >= 0;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  className={s.chooserItem}
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => onChange(on ? chosen.filter((c) => c !== a.id) : [...chosen, a.id])}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of a bucket URL */}
                  <img src={urls[a.image.key]} alt="" />
                  <span>
                    {on && <strong className={s.chooserBadge}>{pos + 1}</strong>} {artworkName(a, i)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className={s.hint} aria-live="polite">
        {summary}
      </p>
    </fieldset>
  );
}
