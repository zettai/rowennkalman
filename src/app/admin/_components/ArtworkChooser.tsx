"use client";

import { useRef } from "react";
import s from "../admin.module.css";
import type { Artwork } from "@/lib/content/schema";

export type ArtworkOption = Pick<Artwork, "id" | "image" | "title">;

/** What to call a painting in the admin when it has no title yet. */
export function artworkName(a: ArtworkOption, index: number): string {
  return a.title.trim() || `Painting ${index + 1}`;
}

type Props = {
  artworks: ArtworkOption[];
  urls: Record<string, string>;
  label: string;
  onPick: (artwork: ArtworkOption) => void;
};

/** A disclosure listing the portfolio's paintings; picking one reuses its picture (no upload). */
export function ArtworkChooser({ artworks, urls, label, onPick }: Props) {
  const details = useRef<HTMLDetailsElement>(null);
  if (artworks.length === 0) return null;
  return (
    <details className={s.chooser} ref={details}>
      <summary className={s.buttonSecondary}>{label}</summary>
      <ul className={s.chooserGrid}>
        {artworks.map((a, i) => (
          <li key={a.id}>
            <button
              type="button"
              className={s.chooserItem}
              onClick={() => {
                onPick(a);
                if (details.current) details.current.open = false;
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of a bucket URL */}
              <img src={urls[a.image.key]} alt="" />
              <span>{artworkName(a, i)}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
