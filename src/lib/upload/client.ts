/**
 * Browser-side image preparation: decode, apply orientation, downscale to a
 * 2800 px longest edge and re-encode as JPEG 0.85 through a canvas. Canvas
 * output carries no EXIF/GPS, so this also strips camera metadata.
 */
import type { ImageRef } from "@/lib/content/schema";

export const MAX_EDGE = 2800;
export const JPEG_QUALITY = 0.85;
/** Long edge of the blurred loading preview. */
export const BLUR_EDGE = 20;
const MAX_BYTES = 5 * 1024 * 1024;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACCEPTED_EXT = /\.(jpe?g|png|webp)$/i;

/** For <input accept>. */
export const ACCEPT_ATTR = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export type UploadStep = "prepare" | "send" | "sizes" | "done";

export class UploadError extends Error {
  constructor(
    message: string,
    /** Where it failed, for the progress panel and the failure log. */
    readonly step: UploadStep = "prepare",
    /** The upload's reference, shown to the editor so a failure can be looked up. */
    readonly id?: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/** A short reference for one upload attempt, e.g. "u-7f3k2x9q". */
export function newUploadId(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(6));
  return `u-${[...rnd].map((b) => (b % 36).toString(36)).join("")}`;
}

/** Returns a friendly message if the file type is not usable, otherwise null. */
export function fileTypeProblem(file: { name: string; type: string }): string | null {
  const type = file.type.toLowerCase();
  if (/hei[cf]/.test(type) || /\.hei[cf]$/i.test(file.name)) {
    return "iPhone HEIC photos can't be used directly. On the iPhone, share or export the photo as JPEG (or set Settings > Camera > Formats to Most Compatible), then try again.";
  }
  if (ACCEPTED_TYPES.has(type) || (!type && ACCEPTED_EXT.test(file.name))) return null;
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

/** A tiny JPEG data URL of the picture, shown blurred while the real one loads (~400 bytes). */
export function makeBlurPreview(source: CanvasImageSource, width: number, height: number): string | undefined {
  try {
    const scale = BLUR_EDGE / Math.max(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", 0.6);
    return url.startsWith("data:image/jpeg;base64,") && url.length < 2000 ? url : undefined;
  } catch {
    return undefined; // the preview is a nicety; never block an upload on it
  }
}

export async function prepareImage(file: File): Promise<{ blob: Blob; width: number; height: number; blur?: string }> {
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
    return { blob, width: canvas.width, height: canvas.height, blur: makeBlurPreview(canvas, canvas.width, canvas.height) };
  } finally {
    decoded.close();
  }
}

export type UploadResult = { image: ImageRef; url: string; id: string };
export type UploadProgress = { step: UploadStep; percent?: number };

type SendResult = { status: number; body: Partial<UploadResult> & { message?: string } };

/** POST with upload progress: fetch cannot report it, XMLHttpRequest can. */
function send(form: FormData, onSent: (percent: number) => void): Promise<SendResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onSent(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      let body: SendResult["body"] = {};
      try {
        body = JSON.parse(xhr.responseText) as SendResult["body"];
      } catch {
        // not JSON (e.g. a gateway error page)
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new Error("network error"));
    xhr.ontimeout = () => reject(new Error("timed out"));
    xhr.timeout = 120_000;
    xhr.send(form);
  });
}

/** Best effort: tells the server about a failure it could not see itself (docs/IMAGES.md). */
export function reportUploadFailure(report: {
  id: string;
  step: "prepare" | "send";
  message: string;
  error?: string;
  status?: number;
  fileType?: string;
  fileBytes?: number;
  ms?: number;
}): void {
  void fetch("/api/admin/client-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * Prepares the file in the browser and uploads it, reporting each step. Throws UploadError
 * (with the step and the upload's reference) with a friendly message.
 */
export async function uploadImage(
  file: File,
  alt = "",
  options: { onProgress?: (p: UploadProgress) => void; id?: string } = {},
): Promise<UploadResult> {
  const id = options.id ?? newUploadId();
  const progress = options.onProgress ?? (() => undefined);
  const t0 = performance.now();
  const context = { id, fileType: file.type.slice(0, 100), fileBytes: file.size };

  progress({ step: "prepare" });
  let prepared: Awaited<ReturnType<typeof prepareImage>>;
  try {
    prepared = await prepareImage(file);
  } catch (err) {
    const message = err instanceof UploadError ? err.message : "Your device could not prepare the picture.";
    reportUploadFailure({ ...context, step: "prepare", message, error: err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 200) : undefined, ms: Math.round(performance.now() - t0) });
    throw new UploadError(message, "prepare", id);
  }

  const form = new FormData();
  form.set("file", prepared.blob, "image.jpg");
  form.set("alt", alt);
  form.set("uploadId", id);
  progress({ step: "send", percent: 0 });
  let res: SendResult;
  try {
    res = await send(form, (percent) => progress(percent < 100 ? { step: "send", percent } : { step: "sizes" }));
  } catch (err) {
    const message = "The picture could not be sent. Check your internet connection and try again.";
    reportUploadFailure({ ...context, step: "send", message, error: err instanceof Error ? err.message : undefined, ms: Math.round(performance.now() - t0) });
    throw new UploadError(message, "send", id);
  }
  if (res.status === 401) throw new UploadError("You have been signed out. Sign in again in a new tab, then try again.", "send", id);
  // The server logged and kept its own failures; only unreadable answers need reporting.
  if (res.status < 200 || res.status >= 300 || !res.body.image || !res.body.url) {
    if (!res.body.message) reportUploadFailure({ ...context, step: "send", message: "Unexpected answer from the server", status: res.status, ms: Math.round(performance.now() - t0) });
    throw new UploadError(res.body.message ?? "The picture could not be uploaded. Please try again.", "sizes", id);
  }
  progress({ step: "done" });
  const image = prepared.blur ? { ...res.body.image, blur: prepared.blur } : res.body.image;
  return { image, url: res.body.url, id };
}

/** Best effort: removes an upload that will not be saved. */
export function discardUpload(key: string): void {
  void fetch(`/api/admin/upload?key=${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => undefined);
}
