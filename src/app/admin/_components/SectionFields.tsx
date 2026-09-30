"use client";

import s from "../admin.module.css";
import { getPath, setPath, type Section } from "@/lib/content/fields";
import type { ImageRef, PageKey } from "@/lib/content/schema";
import type { UploadResult } from "@/lib/upload/client";
import { TextFieldControl, fieldId } from "./TextFieldControl";
import { ImageFieldControl } from "./ImageFieldControl";
import { ImageListControl } from "./ImageListControl";
import { ListControl } from "./ListControl";
import { ArtworkPickControl } from "./ArtworkPickControl";
import type { ArtworkOption } from "./ArtworkChooser";

type Props<T> = {
  page: PageKey;
  section: Section;
  draft: T;
  onDraft: (update: (prev: T) => T) => void;
  urls: Record<string, string>;
  onUploaded: (r: UploadResult) => void;
  onRelease: (key: string) => void;
  onBusyChange: (busy: boolean) => void;
  /** The portfolio's paintings, offered as ready-made pictures for image fields. */
  artworks: ArtworkOption[];
};

/** Renders one registry section: heading, hint and every field in it. */
export function SectionFields<T>({ page, section, draft, onDraft, urls, onUploaded, onRelease, onBusyChange, artworks }: Readonly<Props<T>>) {
  const rel = (path: string) => path.slice(page.length + 1);
  const headingId = `section-${page}-${section.id}`;
  return (
    <section className={s.section} aria-labelledby={headingId}>
      <h2 className={s.sectionTitle} id={headingId}>
        {section.title}
      </h2>
      {section.hint && <p className={s.sectionHint}>{section.hint}</p>}
      {section.fields.map((field) => {
        const path = rel(field.path);
        const value = getPath(draft, path);
        const set = (v: unknown) => onDraft((prev) => setPath(prev, path, v));
        const id = fieldId(field.path);
        switch (field.kind) {
          case "text":
          case "textarea":
          case "url":
            return <TextFieldControl key={field.path} field={field} id={id} value={(value as string) ?? ""} onChange={set} />;
          case "image": {
            const img = (value as ImageRef | null) ?? null;
            return (
              <ImageFieldControl
                key={field.path}
                id={id}
                label={field.label}
                hint={field.hint}
                value={img}
                url={img ? urls[img.key] : undefined}
                artworks={artworks}
                urls={urls}
                onUploaded={onUploaded}
                onBusyChange={onBusyChange}
                onChange={(next) => {
                  if (img && next?.key !== img.key) onRelease(img.key);
                  set(next);
                }}
              />
            );
          }
          case "imageList":
            return (
              <ImageListControl
                key={field.path}
                field={field}
                id={id}
                value={(value as ImageRef[]) ?? []}
                urls={urls}
                artworks={artworks}
                onChange={set}
                onUploaded={onUploaded}
                onRelease={onRelease}
                onBusyChange={onBusyChange}
              />
            );
          case "artworkPick":
            return (
              <ArtworkPickControl
                key={field.path}
                field={field}
                id={id}
                value={(value as string[]) ?? []}
                artworks={artworks}
                urls={urls}
                onChange={set}
              />
            );
          case "list":
            return (
              <ListControl
                key={field.path}
                field={field}
                id={id}
                value={(value as ({ id: string } & Record<string, string>)[]) ?? []}
                onChange={set}
              />
            );
        }
      })}
    </section>
  );
}
