"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import type { ImageRef } from "@/lib/content/schema";

type Props = {
  image: ImageRef;
  src: string;
  /** Pre-made sizes (docs/IMAGES.md): the browser picks one, and Netlify's resizer is not used. */
  srcSet?: string;
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

/** Loaded this soon after mounting = it came from the browser cache: show it, don't fade. */
const INSTANT_MS = 100;

/**
 * A painting that shows a soft blurred preview at once (a ~400-byte JPEG stored with the
 * picture) and fades the real one in when it arrives, so a slow load reads as "coming"
 * instead of an empty grey box. Pictures without a preview simply fade in over grey.
 * A picture that is already cached appears at once, with no preview and no fade.
 */
export function Painting({ image, src, srcSet, sizes, layout = "natural", fit = "cover", priority, eager, className }: Readonly<Props>) {
  const [loaded, setLoaded] = useState(Boolean(priority));
  const [instant, setInstant] = useState(Boolean(priority));
  let loading: "eager" | "lazy" | undefined;
  if (!priority) loading = eager ? "eager" : "lazy"; // priority images set their own loading
  const el = useRef<HTMLImageElement>(null);
  const mountedAt = useRef(0);
  // Before the first paint: a picture that is already there is shown as is.
  useLayoutEffect(() => {
    mountedAt.current = performance.now();
    if (el.current?.complete && el.current.naturalWidth > 0) {
      setInstant(true);
      setLoaded(true);
    }
  }, []);
  const onLoad = () => {
    if (performance.now() - mountedAt.current < INSTANT_MS) setInstant(true);
    setLoaded(true);
  };
  return (
    <span
      className={`fi ${layout === "fill" ? "fi-fill" : "fi-natural"} ${className ?? ""}`}
      style={{
        // The preview only while waiting; for "contain" it is sized like the painting, not the frame.
        backgroundImage: image.blur && !loaded ? `url("${image.blur}")` : undefined,
        backgroundSize: fit === "contain" ? "contain" : undefined,
        aspectRatio: layout === "natural" ? `${image.width} / ${image.height}` : undefined,
      }}
    >
      {srcSet ? (
        <PlainImage
          ref={el}
          src={src}
          srcSet={srcSet}
          alt={image.alt}
          sizes={sizes}
          priority={priority}
          loading={loading}
          loaded={loaded}
          instant={instant}
          fit={fit}
          onLoad={onLoad}
        />
      ) : (
        <Image
          ref={el}
          src={src}
          alt={image.alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={loading}
          data-loaded={loaded}
          data-instant={instant}
          style={{ objectFit: fit }}
          onLoad={onLoad}
        />
      )}
    </span>
  );
}

type PlainProps = {
  ref: React.Ref<HTMLImageElement>;
  src: string;
  srcSet: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  loaded: boolean;
  instant: boolean;
  fit: "cover" | "contain";
  onLoad: () => void;
};

/** What next/image renders for `fill`, but with our own srcset. Priority pictures are preloaded. */
function PlainImage({ ref, src, srcSet, alt, sizes, priority, loading, loaded, instant, fit, onLoad }: Readonly<PlainProps>) {
  if (priority) preload(src, { as: "image", imageSrcSet: srcSet, imageSizes: sizes, fetchPriority: "high" });
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sizes are pre-made; next/image would resize them again
    <img
      ref={ref}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={priority ? "eager" : loading}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      data-loaded={loaded}
      data-instant={instant}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit }}
      onLoad={onLoad}
    />
  );
}
