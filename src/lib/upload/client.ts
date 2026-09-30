/**
 * Browser-side image preparation: decode, apply orientation, downscale to a
 * 2800 px longest edge and re-encode as JPEG 0.85 through a canvas. Canvas
 * output carries no EXIF/GPS, so this also strips camera metadata.
 */
import type { ImageRef } from "@/lib/content/schema";

export const MAX_EDGE = 2800;
export const JPEG_QUALITY = 0.85;
const MAX_BYTES = 5 * 1024 * 1024;

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXT = /\.(jpe?g|png|webp)$/i;

/** For <input accept>. */
export const ACCEPT_ATTR = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export class UploadError extends Error {}

/** Returns a friendly message if the file type is not usable, otherwise null. */
export function fileTypeProblem(file: { name: string; type: string }): string | null {
  const type = file.type.toLowerCase();
  if (/hei[cf]/.test(type) || /\.hei[cf]$/i.test(file.name)) {
    return "iPhone HEIC photos can't be used directly. On the iPhone, share or export the photo as JPEG (or set Settings > Camera > Formats to Most Compatible), then try again.";
  }
  if (ACCEPTED_TYPES.includes(type) || (!type && ACCEPTED_EXT.test(file.name))) return null;
  return "That file type can't be used. Please choose a JPEG, PNG or WebP picture.";
}

/** Target size that fits within MAX_EDGE on the longest side, never upscaling. */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close(): void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" applies the EXIF orientation while decoding.
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // Fall through to <img>, which also honours orientation in current browsers.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new UploadError("This picture could not be opened. It may be damaged or in an unusual format.");
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new UploadError("The picture could not be prepared."))), "image/jpeg", quality),
  );
}

export async function prepareImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const problem = fileTypeProblem(file);
  if (problem) throw new UploadError(problem);
  const decoded = await decode(file);
  try {
    const target = fitWithin(decoded.width, decoded.height);
    // Halve in steps first: a single big downscale on canvas looks jagged.
    let src: CanvasImageSource = decoded.source;
    let w = decoded.width;
    let h = decoded.height;
    while (w / 2 >= target.width && h / 2 >= target.height) {
      const step = document.createElement("canvas");
      step.width = Math.round(w / 2);
      step.height = Math.round(h / 2);
      const sctx = step.getContext("2d");
      if (!sctx) break;
      sctx.imageSmoothingQuality = "high";
      sctx.drawImage(src, 0, 0, step.width, step.height);
      src = step;
      w = step.width;
      h = step.height;
    }
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new UploadError("Your browser could not prepare the picture.");
    ctx.fillStyle = "#ffffff"; // transparent PNG/WebP areas become white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    let blob = await toBlob(canvas, JPEG_QUALITY);
    if (blob.size > MAX_BYTES) blob = await toBlob(canvas, 0.7);
    if (blob.size > MAX_BYTES) throw new UploadError("That picture is too detailed to upload. Please try a smaller one.");
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    decoded.close();
  }
}

export type UploadResult = { image: ImageRef; url: string };

/** Prepares the file in the browser and uploads it. Throws UploadError with a friendly message. */
export async function uploadImage(file: File, alt = ""): Promise<UploadResult> {
  const { blob } = await prepareImage(file);
  const form = new FormData();
  form.set("file", blob, "image.jpg");
  form.set("alt", alt);
  let res: Response;
  try {
    res = await fetch("/api/admin/upload", { method: "POST", body: form });
  } catch {
    throw new UploadError("The picture could not be sent. Check your internet connection and try again.");
  }
  if (res.status === 401) throw new UploadError("You have been signed out. Sign in again in a new tab, then try again.");
  const body = (await res.json().catch(() => ({}))) as Partial<UploadResult> & { message?: string };
  if (!res.ok || !body.image || !body.url) throw new UploadError(body.message ?? "The picture could not be uploaded. Please try again.");
  return { image: body.image, url: body.url };
}

/** Best effort: removes an upload that will not be saved. */
export function discardUpload(key: string): void {
  void fetch(`/api/admin/upload?key=${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => undefined);
}
