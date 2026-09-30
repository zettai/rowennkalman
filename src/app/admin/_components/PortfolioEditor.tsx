"use client";

import { useRef, useState } from "react";
import s from "../admin.module.css";
import type { Artwork, Content, ImageRef } from "@/lib/content/schema";
import { ALT_TEXT_HINT, ARTWORK_FIELDS, getPageDef } from "@/lib/content/fields";
import type { UploadResult } from "@/lib/upload/client";
import { EditorShell } from "./EditorShell";
import { SectionFields } from "./SectionFields";
import { TextFieldControl } from "./TextFieldControl";
import { ImageFieldControl } from "./ImageFieldControl";
import { ImagePicker } from "./ImagePicker";
import { usePageEditor, type ImageUrls } from "./usePageEditor";
import { move } from "./move";
import { useMoveFocus } from "./useMoveFocus";

type Props = { content: Content; imageUrls: ImageUrls };

const blankArtwork = (image: ImageRef): Artwork => ({
  id: crypto.randomUUID(),
  image,
  title: "",
  medium: "",
  size: "",
  year: "",
  description: "",
});

const artName = (a: Artwork) => (a.title.trim() ? `“${a.title.trim()}”` : "this painting");

export function PortfolioEditor({ content, imageUrls }: Props) {
  const def = getPageDef("portfolio")!;
  const ed = usePageEditor("portfolio", content, imageUrls);
  const [uploads, setUploads] = useState(0);
  const onBusyChange = (busy: boolean) => setUploads((n) => Math.max(0, n + (busy ? 1 : -1)));
  const onUploaded = (r: UploadResult) => ed.addImageUrl(r.image.key, r.url);

  const [adding, setAdding] = useState<Artwork | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const focus = useMoveFocus();
  const heading = useRef<HTMLHeadingElement>(null);

  const artworks = ed.draft.artworks;
  const setArtworks = (fn: (prev: Artwork[]) => Artwork[]) => ed.update((p) => ({ ...p, artworks: fn(p.artworks) }));
  const patchArtwork = (id: string, patch: Partial<Artwork>) =>
    setArtworks((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const cancelAdd = () => {
    if (adding) ed.releaseImage(adding.image.key);
    setAdding(null);
    requestAnimationFrame(() => heading.current?.focus());
  };

  const confirmAdd = () => {
    if (!adding) return;
    const item = adding;
    setArtworks((list) => [...list, item]);
    setAdding(null);
    focus.announce(`${artName(item)} added at position ${artworks.length + 1}. Press Save changes to publish it.`);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-item-id="${item.id}"] [data-action="edit"]`)?.focus());
  };

  const remove = (a: Artwork) => {
    ed.releaseImage(a.image.key);
    setArtworks((list) => list.filter((x) => x.id !== a.id));
    setConfirming(null);
    if (editing === a.id) setEditing(null);
    focus.announce(`${artName(a)} removed. Press Save changes to remove it from the site.`);
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <EditorShell
      title={def.title}
      description={def.description}
      publicPath={def.publicPath}
      dirty={ed.dirty}
      busy={uploads > 0}
      status={ed.status}
      onSave={ed.save}
    >
      {def.sections.map((section) => (
        <SectionFields
          key={section.id}
          page="portfolio"
          section={section}
          draft={ed.draft}
          onDraft={(fn) => ed.update(fn)}
          urls={ed.urls}
          onUploaded={onUploaded}
          onRelease={ed.releaseImage}
          onBusyChange={onBusyChange}
          artworks={[]}
        />
      ))}

      <section className={s.section} aria-labelledby="paintings-title">
        <h2 className={s.sectionTitle} id="paintings-title" ref={heading} tabIndex={-1}>
          Paintings ({artworks.length})
        </h2>
        <p className={s.sectionHint}>Shown on the site in this order. Use Up and Down to change the order.</p>

        {adding ? (
          <div className={s.section} style={{ background: "#fbfaf7" }} role="group" aria-labelledby="add-title">
            <h3 className={s.sectionTitle} id="add-title">
              New painting
            </h3>
            <ImageFieldControl
              id="new-art-image"
              label="Picture"
              hint="A photo of the painting."
              value={adding.image}
              url={ed.urls[adding.image.key]}
              removable={false}
              onUploaded={onUploaded}
              onBusyChange={onBusyChange}
              onChange={(img) => {
                if (img && img.key !== adding.image.key) ed.releaseImage(adding.image.key);
                if (img) setAdding({ ...adding, image: img });
              }}
            />
            {ARTWORK_FIELDS.map((f) => (
              <TextFieldControl
                key={f.path}
                field={f}
                id={`new-art-${f.path}`}
                value={adding[f.path as keyof Artwork] as string}
                onChange={(v) => setAdding({ ...adding, [f.path]: v })}
              />
            ))}
            <div className={s.row} style={{ marginTop: 16 }}>
              <button type="button" className={s.button} onClick={confirmAdd} disabled={uploads > 0}>
                Add to portfolio
              </button>
              <button type="button" className={s.buttonSecondary} onClick={cancelAdd}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <ImagePicker
              label="+ Add a painting"
              testId="add-painting-file"
              onBusyChange={onBusyChange}
              onUploaded={(r) => {
                onUploaded(r);
                setAdding(blankArtwork(r.image));
                requestAnimationFrame(() => document.getElementById("new-art-title")?.focus());
              }}
            />
            <span className={s.hint}>Choose a photo of the painting first; then fill in its details.</span>
          </div>
        )}

        <ol className={s.grid} data-testid="artwork-grid">
          {artworks.map((a, i) => {
            const open = editing === a.id;
            const name = artName(a);
            return (
              <li key={a.id} className={`${s.art} ${open ? s.artOpen : ""}`} data-item-id={a.id} data-testid="artwork-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of a bucket URL */}
                <img className={s.thumb} src={ed.urls[a.image.key]} alt={a.image.alt || ""} loading="lazy" style={open ? { maxWidth: 320 } : undefined} />
                <div className={s.artBody}>
                  <span className={s.position}>
                    {i + 1} of {artworks.length}
                  </span>
                  <p className={s.artTitle}>{a.title.trim() || "Untitled"}</p>
                  <p className={s.artMeta}>{[a.medium, a.size, a.year].filter(Boolean).join(" · ") || "No details yet"}</p>
                  <div className={s.artActions}>
                    <button
                      type="button"
                      className={s.buttonSecondary}
                      data-action="edit"
                      aria-expanded={open}
                      aria-controls={`edit-${a.id}`}
                      onClick={() => setEditing(open ? null : a.id)}
                    >
                      {open ? "Done" : "Edit"}
                    </button>
                    <button
                      type="button"
                      className={s.buttonSecondary}
                      data-action="up"
                      disabled={i === 0}
                      aria-label={`Move ${name} up`}
                      onClick={() => {
                        setArtworks((list) => move(list, i, -1));
                        focus.moved(a.id, "up", name, i, artworks.length);
                      }}
                    >
                      ↑ Up
                    </button>
                    <button
                      type="button"
                      className={s.buttonSecondary}
                      data-action="down"
                      disabled={i === artworks.length - 1}
                      aria-label={`Move ${name} down`}
                      onClick={() => {
                        setArtworks((list) => move(list, i, 1));
                        focus.moved(a.id, "down", name, i + 2, artworks.length);
                      }}
                    >
                      ↓ Down
                    </button>
                    {confirming !== a.id && (
                      <button type="button" className={s.buttonQuiet} data-action="delete" onClick={() => setConfirming(a.id)}>
                        <span className={s.dangerLink}>Delete…</span>
                      </button>
                    )}
                  </div>
                  {confirming === a.id && (
                    <div className={s.confirm} role="group" aria-label={`Confirm deleting ${name}`}>
                      <p>Delete {name}? It will be removed from the site, with its picture, when you save.</p>
                      <div className={s.row}>
                        <button type="button" className={s.buttonDanger} onClick={() => remove(a)}>
                          Yes, delete
                        </button>
                        <button type="button" className={s.buttonSecondary} onClick={() => setConfirming(null)} autoFocus>
                          Keep it
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {open && (
                  <div className={s.editPanel} id={`edit-${a.id}`}>
                    {ARTWORK_FIELDS.map((f) => (
                      <TextFieldControl
                        key={f.path}
                        field={f}
                        id={`art-${a.id}-${f.path}`}
                        value={a[f.path as keyof Artwork] as string}
                        onChange={(v) => patchArtwork(a.id, { [f.path]: v })}
                      />
                    ))}
                    <ImageFieldControl
                      id={`art-${a.id}-image`}
                      label="Picture"
                      hint={`Replace the photo of this painting. ${ALT_TEXT_HINT}`}
                      value={a.image}
                      url={ed.urls[a.image.key]}
                      removable={false}
                      onUploaded={onUploaded}
                      onBusyChange={onBusyChange}
                      onChange={(img) => {
                        if (!img) return;
                        if (img.key !== a.image.key) ed.releaseImage(a.image.key);
                        patchArtwork(a.id, { image: img });
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <span className={s.visuallyHidden} aria-live="polite">
          {focus.announcement}
        </span>
      </section>
    </EditorShell>
  );
}
