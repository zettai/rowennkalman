"use client";

import { useId, useRef, useState } from "react";
import s from "../admin.module.css";
import { ACCEPT_ATTR, UploadError, uploadImage, type UploadResult } from "@/lib/upload/client";

type Props = {
  label: string;
  onUploaded: (result: UploadResult) => void;
  onBusyChange?: (busy: boolean) => void;
  secondary?: boolean;
  testId?: string;
};

/** A button that picks a picture, prepares it in the browser and uploads it. */
export function ImagePicker({ label, onUploaded, onBusyChange, secondary, testId }: Readonly<Props>) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    onBusyChange?.(true);
    try {
      onUploaded(await uploadImage(file));
    } catch (err) {
      setError(err instanceof UploadError ? err.message : "The picture could not be uploaded. Please try again.");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={input}
        id={id}
        type="file"
        accept={ACCEPT_ATTR}
        className={s.fileInput}
        disabled={busy}
        data-testid={testId}
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      <label htmlFor={id} className={secondary ? s.buttonSecondary : s.button} aria-disabled={busy}>
        {busy ? "Preparing picture…" : label}
      </label>
      <div aria-live="polite">
        {error && (
          <p className={s.fieldError} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
