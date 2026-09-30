import { getStore } from "@/lib/store";
import { unauthorized } from "@/lib/auth/server";
import { handleDiscardUpload, handleUpload, uploadIdFrom } from "@/lib/admin/handlers";
import { MAX_UPLOAD_BYTES } from "@/lib/upload/verify";

export const dynamic = "force-dynamic";

/**
 * multipart/form-data: file (image/jpeg, already processed in the browser), alt, uploadId.
 * Returns { image, url, id }; the server also makes the picture's WebP sizes (docs/IMAGES.md).
 */
export async function POST(req: Request) {
  const denied = await unauthorized();
  if (denied) return denied;
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) {
    return Response.json({ error: "too-large", message: "That picture is too large (over 5 MB) even after shrinking." }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid", message: "The upload was not understood." }, { status: 400 });
  }
  const file = form.get("file");
  const result = await handleUpload(getStore(), file instanceof Blob ? file : null, form.get("alt"), {
    id: uploadIdFrom(form.get("uploadId")),
  });
  return Response.json(result.body, { status: result.status });
}

/** ?key=art/<uuid>.jpg: removes an upload that was discarded before saving. */
export async function DELETE(req: Request) {
  const denied = await unauthorized();
  if (denied) return denied;
  const result = await handleDiscardUpload(getStore(), new URL(req.url).searchParams.get("key"));
  return Response.json(result.body, { status: result.status });
}
