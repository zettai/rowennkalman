"use client";

import { useCallback, useMemo, useState } from "react";
import { collectImageKeys, type PageKey } from "@/lib/content/helpers";
import type { Content } from "@/lib/content/schema";
import { discardUpload } from "@/lib/upload/client";

export type ImageUrls = Record<string, string>;

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "conflict" }
  | { kind: "signedOut" }
  | { kind: "invalid"; message: string; issues: { path: string; message: string }[] }
  | { kind: "error"; message: string };

/** Draft state for one page of Content, with save, conflict and image URL handling. */
export function usePageEditor<P extends PageKey>(page: P, initial: Content, initialUrls: ImageUrls) {
  const [saved, setSaved] = useState<Content>(initial);
  const [draft, setDraft] = useState<Content[P]>(initial[page]);
  const [urls, setUrls] = useState<ImageUrls>(initialUrls);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved[page]), [draft, saved, page]);

  const update = useCallback((next: Content[P] | ((prev: Content[P]) => Content[P])) => {
    setDraft(next);
    setStatus((s) => (s.kind === "saved" || s.kind === "invalid" || s.kind === "error" ? { kind: "idle" } : s));
  }, []);

  const addImageUrl = useCallback((key: string, url: string) => setUrls((u) => ({ ...u, [key]: url })), []);

  /** Call when an image leaves the draft: if it was never saved, remove the upload now. */
  const releaseImage = useCallback(
    (key: string) => {
      if (!collectImageKeys(saved).has(key)) discardUpload(key);
    },
    [saved],
  );

  const save = useCallback(async () => {
    if (status.kind === "saving") return;
    setStatus({ kind: "saving" });
    let res: Response;
    try {
      res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, value: draft, expectedUpdatedAt: saved.updatedAt }),
      });
    } catch {
      setStatus({ kind: "error", message: "Could not reach the site. Check your internet connection and press Save again. Your changes are still here." });
      return;
    }
    const body = (await res.json().catch(() => ({}))) as {
      content?: Content;
      imageUrls?: ImageUrls;
      message?: string;
      issues?: { path: string; message: string }[];
    };
    if (res.ok && body.content) {
      setSaved(body.content);
      setDraft(body.content[page]);
      setUrls((u) => ({ ...u, ...body.imageUrls }));
      setStatus({ kind: "saved" });
    } else if (res.status === 409) {
      setStatus({ kind: "conflict" });
    } else if (res.status === 401) {
      setStatus({ kind: "signedOut" });
    } else if (res.status === 400) {
      setStatus({ kind: "invalid", message: body.message ?? "Some fields could not be saved.", issues: body.issues ?? [] });
    } else {
      setStatus({ kind: "error", message: "Something went wrong while saving. Please press Save again. Your changes are still here." });
    }
  }, [draft, page, saved.updatedAt, status.kind]);

  return { saved, draft, update, dirty, status, save, urls, addImageUrl, releaseImage };
}

export type PageEditorApi<P extends PageKey> = ReturnType<typeof usePageEditor<P>>;
