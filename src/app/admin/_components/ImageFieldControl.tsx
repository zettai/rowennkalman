"use client";

import s from "../admin.module.css";
import type { ImageRef } from "@/lib/content/schema";
import { ALT_TEXT_HINT } from "@/lib/content/fields";
import { ImagePicker } from "./ImagePicker";
import type { UploadResult } from "@/lib/upload/client";
import { ArtworkChooser, type ArtworkOption } from "./ArtworkChooser";

type Props = {
  id: string;
  label: string;
  hint: string;
  value: ImageRef | null;
  url: string | undefined;
  onChange: (next: ImageRef | null) => void;
  onUploaded: (result: UploadResult) => void;
  onBusyChange: (busy: boolean) => void;
  removable?: boolean;
  /** When given, the picture can also be one of these paintings (no upload). */
  artworks?: ArtworkOption[];
  urls?: Record<string, string>;
  children?: React.ReactNode;
};

/** One image: preview, pick/replace, remove, alt text. */
export function ImageFieldControl({
  id,
  label,
  hint,
  value,
  url,
  onChange,
  onUploaded,
  onBusyChange,
  removable = true,
  artworks,
  urls,
  children,
}: Props) {
  return (
    <div className={s.field} role="group" aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`}>
      <span className={s.label} id={`${id}-label`}>
        {label}
      </span>
      <span className={s.hint} id={`${id}-hint`}>
        {hint}
      </span>
      <div className={s.imageBox}>
        {value && url ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview of a bucket URL
          <img className={s.preview} src={url} alt={value.alt ? `Preview: ${value.alt}` : "Preview of the chosen picture"} />
        ) : value ? (
          <div className={s.previewEmpty}>Picture chosen</div>
        ) : (
          <div className={s.previewEmpty}>No picture yet</div>
        )}
        <div>
          <div className={s.row}>
            <ImagePicker
              label={value ? "Replace picture" : "Choose a picture"}
              secondary={Boolean(value)}
              onBusyChange={onBusyChange}
              onUploaded={(r) => {
                onUploaded(r);
                onChange({ ...r.image, alt: value?.alt ?? "" });
              }}
            />
            {artworks && urls && (
              <ArtworkChooser
                artworks={artworks}
                urls={urls}
                label={value ? "Use a painting from your portfolio instead" : "Use a painting from your portfolio"}
                onPick={(a) => onChange({ ...a.image })}
              />
            )}
            {value && removable && (
              <button type="button" className={s.buttonQuiet} onClick={() => onChange(null)}>
                Remove picture
              </button>
            )}
            {children}
          </div>
          {value && (
            <div className={s.field}>
              <label className={s.label} htmlFor={`${id}-alt`}>
                Picture description
              </label>
              <span className={s.hint} id={`${id}-alt-hint`}>
                {ALT_TEXT_HINT}
              </span>
              <input
                id={`${id}-alt`}
                className={s.input}
                aria-describedby={`${id}-alt-hint`}
                value={value.alt}
                maxLength={500}
                onChange={(e) => onChange({ ...value, alt: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
