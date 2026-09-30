"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Artwork } from "./content";

type Item = Artwork & { src: string };

function details(a: Artwork): string {
  return [a.medium, a.size, a.year].filter(Boolean).join(", ");
}

export function Gallery({ items }: { items: Item[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [index, setIndex] = useState<number | null>(null);

  const open = (i: number, button: HTMLButtonElement) => {
    opener.current = button;
    setIndex(i);
    dialog.current?.showModal();
  };

  const step = useCallback(
    (delta: number) => setIndex((i) => (i === null ? i : (i + delta + items.length) % items.length)),
    [items.length],
  );

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    const onClose = () => {
      setIndex(null);
      opener.current?.focus();
    };
    el.addEventListener("keydown", onKey);
    el.addEventListener("close", onClose);
    return () => {
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("close", onClose);
    };
  }, [step]);

  const current = index === null ? null : items[index];

  return (
    <>
      <ul className="gallery" data-testid="artworks">
        {items.map((a, i) => (
          <li key={a.id}>
            <button type="button" className="gallery-thumb" onClick={(e) => open(i, e.currentTarget)}>
              <Image
                src={a.src}
                alt={a.image.alt}
                fill
                sizes="(max-width: 767px) 50vw, 22vw"
              />
            </button>
            {(a.title || details(a)) && (
              <div className="gallery-caption">
                {a.title && (
                  <p className="artwork-title" data-testid="artwork-title">
                    {a.title}
                  </p>
                )}
                {details(a) && <p className="artwork-details">{details(a)}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        className="lightbox"
        aria-label={current?.title || "Artwork"}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        {current && (
          <div className="lightbox-inner">
            <div className="lightbox-image">
              <Image
                key={current.id}
                src={current.src}
                alt={current.image.alt}
                fill
                loading="eager"
                sizes="90vw"
              />
            </div>
            {(current.title || details(current) || current.description) && (
              <div className="lightbox-text">
                {current.title && <h2 className="artwork-title">{current.title}</h2>}
                {details(current) && <p className="artwork-details">{details(current)}</p>}
                {current.description && <p>{current.description}</p>}
              </div>
            )}
            <div className="lightbox-controls">
              <button type="button" onClick={() => step(-1)} aria-label="Previous artwork">
                ←
              </button>
              <span aria-live="polite">
                {index! + 1} / {items.length}
              </span>
              <button type="button" onClick={() => step(1)} aria-label="Next artwork">
                →
              </button>
              <button type="button" onClick={() => dialog.current?.close()} className="lightbox-close">
                Close
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
