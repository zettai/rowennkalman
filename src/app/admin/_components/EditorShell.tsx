"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "../admin.module.css";
import type { SaveStatus } from "./usePageEditor";
import { useLiveCheck, type LiveState } from "./useLiveCheck";
import { useStaleCheck } from "./useStaleCheck";

export const CONFLICT_MESSAGE = "This page was changed in another tab. Reload to see the latest.";

type Props = {
  title: string;
  description: string;
  publicPath: string;
  dirty: boolean;
  busy?: boolean;
  status: SaveStatus;
  onSave: () => void;
  /** The content version this page was loaded (or last saved) with. */
  version: string;
  children: ReactNode;
};

/** Page frame: heading, form, sticky save bar, unsaved-changes guard. */
export function EditorShell({ title, description, publicPath, dirty, busy, status, onSave, version, children }: Props) {
  const live = useLiveCheck(publicPath, status.kind === "saved" ? status.version : undefined);
  const newer = useStaleCheck(version);
  const conflictRef = useRef<HTMLDivElement>(null);
  const outdated = status.kind === "conflict" || newer !== null;
  // Bring the notice into view when a save is refused, so it isn't missed in the bottom bar.
  useEffect(() => {
    if (status.kind === "conflict") {
      conflictRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      conflictRef.current?.focus();
    }
  }, [status.kind]);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const leaving = useRef(false);
  const stayRef = useRef<HTMLButtonElement>(null);

  // Closing the tab or reloading with unsaved changes: the browser asks.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty || leaving.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Clicking a link inside the app with unsaved changes: ask in the page, not a browser dialog.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirty || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.dataset.leave === "ok") return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  useEffect(() => {
    if (pendingHref) stayRef.current?.focus();
  }, [pendingHref]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !busy) onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, busy, onSave]);

  const leave = () => {
    if (!pendingHref) return;
    leaving.current = true;
    window.location.assign(pendingHref);
  };
  const reload = () => {
    leaving.current = true;
    window.location.reload();
  };

  return (
    <>
      <p className={s.crumbs}>
        <Link href="/admin">All pages</Link>
      </p>
      <h1 className={s.h1}>{title}</h1>
      <p className={s.lead}>{description}</p>

      {outdated && (
        <div ref={conflictRef} tabIndex={-1} className={s.noticeWarn} role="alert" data-testid="outdated-notice">
          <p style={{ fontWeight: 700, margin: "0 0 4px" }}>
            {status.kind === "conflict" ? "Not saved: this page was changed somewhere else" : "This page was changed somewhere else"}
          </p>
          <p style={{ margin: "0 0 10px" }}>
            {status.kind === "conflict"
              ? "Someone (maybe you, in another tab or on another device) saved a newer version first. Reload to get it, then make your change again."
              : "A newer version was saved since you opened this page (maybe in another tab or on another device). Reload before you edit, so nothing is lost."}
            {dirty && " Reloading drops the changes you made here, so copy any text you want to keep first."}
          </p>
          <button type="button" className={s.button} onClick={reload}>
            Reload the latest version
          </button>
        </div>
      )}

      {pendingHref && (
        <div className={s.noticeWarn} role="alertdialog" aria-labelledby="leave-title" aria-describedby="leave-text">
          <p id="leave-title" style={{ fontWeight: 700, margin: "0 0 4px" }}>
            You have unsaved changes
          </p>
          <p id="leave-text" style={{ margin: "0 0 10px" }}>
            If you leave now, the changes on this page will be lost.
          </p>
          <div className={s.row}>
            <button ref={stayRef} type="button" className={s.button} onClick={() => setPendingHref(null)}>
              Stay on this page
            </button>
            <button type="button" className={s.buttonSecondary} onClick={leave}>
              Leave without saving
            </button>
          </div>
        </div>
      )}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onSave();
        }}
        id="page-form"
      >
        {children}
      </form>

      <div className={s.saveBar} data-save-bar>
        <div className={s.saveBarInner}>
          <div className={s.status} role="status" aria-live="polite" data-testid="save-status">
            <StatusText status={status} dirty={dirty} busy={busy} onReload={reload} live={live} />
          </div>
          <div className={s.row}>
            <a className={s.buttonSecondary} href={publicPath} target="_blank" rel="noreferrer">
              View this page
            </a>
            <button type="submit" form="page-form" className={s.button} disabled={!dirty || busy || status.kind === "saving"}>
              {status.kind === "saving" ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function StatusText({
  status,
  dirty,
  busy,
  onReload,
  live,
}: {
  status: SaveStatus;
  dirty: boolean;
  busy?: boolean;
  onReload: () => void;
  live: LiveState | null;
}) {
  switch (status.kind) {
    case "saving":
      return <span>Saving…</span>;
    case "saved":
      if (live === "checking") return <span>Saved. Checking the site…</span>;
      if (live === "slow")
        return (
          <span className={s.inlineStatusWarn}>
            Saved, but the site hasn&apos;t shown it yet. Check again in a minute; if it still shows the old version, tell Luis.
          </span>
        );
      return <span className={s.inlineStatusOk}>Saved. Your changes are live on the site.</span>;
    case "conflict":
      return (
        <span className={s.inlineStatusWarn} role="alert">
          {CONFLICT_MESSAGE}{" "}
          <button type="button" className={s.buttonSecondary} onClick={onReload}>
            Reload
          </button>
        </span>
      );
    case "signedOut":
      return (
        <span className={s.inlineStatusError} role="alert">
          You were signed out, so this was not saved.{" "}
          <a href="/admin/login" target="_blank" rel="noreferrer">
            Sign in again in a new tab
          </a>
          , then come back and press Save. Your changes are still here.
        </span>
      );
    case "invalid":
      return (
        <span className={s.inlineStatusError} role="alert">
          Not saved: {status.message}
          {status.issues.length > 0 && ` (${status.issues.map((i) => i.path || "page").join(", ")})`}
        </span>
      );
    case "error":
      return (
        <span className={s.inlineStatusError} role="alert">
          Not saved. {status.message}
        </span>
      );
    default:
      if (busy) return <span>Please wait for the picture to finish…</span>;
      return dirty ? <span className={s.inlineStatusWarn}>You have unsaved changes.</span> : <span>All changes are saved.</span>;
  }
}
