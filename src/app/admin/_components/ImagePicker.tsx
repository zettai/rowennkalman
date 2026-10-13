"use client";

import { useId, useRef, useState } from "react";
import s from "../admin.module.css";
import { ACCEPT_ATTR, UploadError, uploadImage, type UploadProgress, type UploadResult, type UploadStep } from "@/lib/upload/client";

type Props = {
  label: string;
  onUploaded: (result: UploadResult) => void;
  onBusyChange?: (busy: boolean) => void;
  secondary?: boolean;
  testId?: string;
};

const STEPS: { step: Exclude<UploadStep, "done">; label: string }[] = [
  { step: "prepare", label: "Preparing the picture on this device" },
  { step: "send", label: "Sending" },
  { step: "sizes", label: "Saving it and making sizes for phones and computers" },
];
const ORDER: UploadStep[] = ["prepare", "send", "sizes", "done"];

type Failure = { message: string; step: UploadStep; id?: string };

/**
 * A button that picks a picture, prepares it in the browser and uploads it. While it works, a
 * panel shows each step (with the sending percentage); a failure names the step, shows the
 * upload's reference (to look it up: npm run upload-failures) and offers Try again.
 */
export function ImagePicker({ label, onUploaded, onBusyChange, secondary, testId }: Readonly<Props>) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const busy = progress !== null && progress.step !== "done";

  const start = async (file: File | undefined) => {
    if (!file) return;
    setLastFile(file);
    setFailure(null);
    setProgress({ step: "prepare" });
    onBusyChange?.(true);
    try {
      onUploaded(await uploadImage(file, "", { onProgress: setProgress }));
      setProgress(null);
      setLastFile(null);
    } catch (err) {
      const e = err instanceof UploadError ? err : new UploadError("The picture could not be uploaded. Please try again.");
      setFailure({ message: e.message, step: e.step, id: e.id });
      setProgress(null);
    } finally {
      onBusyChange?.(false);
      if (input.current) input.current.value = "";
    }
  };

  const current = busy ? progress.step : failure?.step;
  const stateOf = (step: UploadStep): "done" | "active" | "failed" | "waiting" => {
    if (!current) return "waiting";
    const at = ORDER.indexOf(current);
    const mine = ORDER.indexOf(step);
    if (mine < at) return "done";
    if (mine > at) return "waiting";
    return failure ? "failed" : "active";
  };
  const suffix = (step: UploadStep, state: string) => {
    if (state !== "active") return "";
    return step === "send" && progress?.percent !== undefined ? `… ${progress.percent}%` : "…";
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
        onChange={(e) => void start(e.target.files?.[0])}
      />
      {!busy && (
        <label htmlFor={id} className={secondary ? s.buttonSecondary : s.button}>
          {label}
        </label>
      )}
      {(busy || failure) && (
        <div className={s.uploadPanel} data-testid="upload-progress">
          <ol className={s.uploadSteps}>
            {STEPS.map(({ step, label: text }) => {
              const state = stateOf(step);
              return (
                <li key={step} data-state={state}>
                  <span className={s.uploadMark} aria-hidden="true">
                    {{ done: "✓", failed: "✕", active: "", waiting: "○" }[state]}
                  </span>
                  <span>
                    {text}
                    {suffix(step, state)}
                  </span>
                </li>
              );
            })}
          </ol>
          {failure && (
            <div role="alert">
              <p className={s.fieldError}>{failure.message}</p>
              {failure.id && <p className={s.uploadRef}>Reference: {failure.id}</p>}
              {lastFile && (
                <button type="button" className={s.buttonSecondary} onClick={() => void start(lastFile)}>
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <p className={s.visuallyHidden} aria-live="polite">
        {busy ? STEPS.find((x) => x.step === progress.step)?.label : ""}
      </p>
    </div>
  );
}
