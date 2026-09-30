"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ImageRef } from "@/lib/content/schema";

type Props = {
  image: ImageRef;
  src: string;
  sizes: string;
  /** "fill": the parent is a positioned frame (fills it). "natural": keeps the picture's own proportions. */
  layout?: "fill" | "natural";
  /** Painting fills the frame (cover) or is shown whole (contain). */
  fit?: "cover" | "contain";
  /** Above-the-fold: preloaded, and shown without the fade so it never flashes. */
  priority?: boolean;
  /** Load right away instead of when scrolled near (for the first rows on a page). */
  eager?: boolean;
  className?: string;
};

/**
 * A painting that shows a soft blurred preview at once (a ~400-byte JPEG stored with the
 * picture) and fades the real one in when it arrives, so a slow load reads as "coming"
 * instead of an empty grey box. Pictures without a preview simply fade in over grey.
 */
export function Painting({ image, src, sizes, layout = "natural", fit = "cover", priority, eager, className }: Props) {
  const [loaded, setLoaded] = useState(Boolean(priority));
  const el = useRef<HTMLImageElement>(null);
  // Already in the cache before the page came alive: nothing to fade.
  useEffect(() => {
    if (el.current?.complete && el.current.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    <span
      className={`fi ${layout === "fill" ? "fi-fill" : "fi-natural"} ${className ?? ""}`}
      style={{
        backgroundImage: image.blur ? `url("${image.blur}")` : undefined,
        aspectRatio: layout === "natural" ? `${image.width} / ${image.height}` : undefined,
      }}
    >
      <Image
        ref={el}
        src={src}
        alt={image.alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : eager ? "eager" : "lazy"}
        data-loaded={loaded}
        style={{ objectFit: fit }}
        onLoad={() => setLoaded(true)}
      />
    </span>
  );
}
