"use client";

import s from "../admin.module.css";
import type { ImageRef } from "@/lib/content/schema";
import type { ImageListField } from "@/lib/content/fields";
import type { UploadResult } from "@/lib/upload/client";
import { ImageFieldControl } from "./ImageFieldControl";
import { ImagePicker } from "./ImagePicker";
import { move } from "./move";
import { useMoveFocus } from "./useMoveFocus";
import { ArtworkChooser, type ArtworkOption } from "./ArtworkChooser";

type Props = {
  field: ImageListField;
  id: string;
  value: ImageRef[];
  urls: Record<string, string>;
  artworks: ArtworkOption[];
  onChange: (next: ImageRef[]) => void;
  onUploaded: (r: UploadResult) => void;
  onRelease: (key: string) => void;
  onBusyChange: (busy: boolean) => void;
};

/** An ordered list of pictures with alt text, reorder and remove. */
export function ImageListControl({ field, id, value, urls, artworks, onChange, onUploaded, onRelease, onBusyChange }: Props) {
  const focus = useMoveFocus();
  return (
    <div className={s.field} role="group" aria-labelledby={`${id}-label`}>
      <span className={s.label} id={`${id}-label`}>
        {field.label}
      </span>
      <span className={s.hint}>{field.hint}</span>
      <ol className={s.imageList}>
        {value.map((img, i) => (
          <li key={img.key} className={s.imageListItem} data-item-id={img.key}>
            <ImageFieldControl
              id={`${id}-${i}`}
              label={`Picture ${i + 1} of ${value.length}`}
              hint=""
              value={img}
              url={urls[img.key]}
              removable={false}
              artworks={artworks}
              urls={urls}
              onBusyChange={onBusyChange}
              onUploaded={onUploaded}
              onChange={(next) => {
                if (next && next.key !== img.key) onRelease(img.key);
                onChange(value.map((v, j) => (j === i ? next! : v)));
              }}
            >
              <button
                type="button"
                className={s.buttonSecondary}
                data-action="up"
                disabled={i === 0}
                aria-label={`Move picture ${i + 1} up`}
                onClick={() => {
                  onChange(move(value, i, -1));
                  focus.moved(img.key, "up", `picture ${i + 1}`, i, value.length);
                }}
              >
                ↑ Up
              </button>
              <button
                type="button"
                className={s.buttonSecondary}
                data-action="down"
                disabled={i === value.length - 1}
                aria-label={`Move picture ${i + 1} down`}
                onClick={() => {
                  onChange(move(value, i, 1));
                  focus.moved(img.key, "down", `picture ${i + 1}`, i + 2, value.length);
                }}
              >
                ↓ Down
              </button>
              <button
                type="button"
                className={s.buttonQuiet}
                onClick={() => {
                  onRelease(img.key);
                  onChange(value.filter((_, j) => j !== i));
                  focus.announce(`Removed picture ${i + 1}.`);
                }}
              >
                Remove
              </button>
            </ImageFieldControl>
          </li>
        ))}
      </ol>
      <span className={s.visuallyHidden} aria-live="polite">
        {focus.announcement}
      </span>
      {value.length < field.max && (
        <div className={`${s.field} ${s.row}`}>
          <ImagePicker
            label="Add a picture"
            secondary
            onBusyChange={onBusyChange}
            onUploaded={(r) => {
              onUploaded(r);
              onChange([...value, r.image]);
            }}
          />
          <ArtworkChooser
            artworks={artworks.filter((a) => !value.some((v) => v.key === a.image.key))}
            urls={urls}
            label="Add a painting from your portfolio"
            onPick={(a) => onChange([...value, { ...a.image }])}
          />
        </div>
      )}
    </div>
  );
}
