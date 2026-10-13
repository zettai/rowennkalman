"use client";

import { useEffect, useRef, useState } from "react";

/**
 * After an item moves, keep keyboard focus on the same button of the moved item
 * (or its sibling button when it reached the end), and announce the new position.
 */
export function useMoveFocus() {
  const pending = useRef<{ id: string; action: "up" | "down" } | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const target = pending.current;
    if (!target) return;
    pending.current = null;
    const item = document.querySelector(`[data-item-id="${CSS.escape(target.id)}"]`);
    const preferred = item?.querySelector<HTMLButtonElement>(`[data-action="${target.action}"]`);
    const other = item?.querySelector<HTMLButtonElement>(`[data-action="${target.action === "up" ? "down" : "up"}"]`);
    (preferred && !preferred.disabled ? preferred : other)?.focus();
  }, [focusTick]);

  return {
    announcement,
    moved(id: string, action: "up" | "down", name: string, position: number, total: number) {
      pending.current = { id, action };
      setFocusTick((n) => n + 1);
      setAnnouncement(`Moved ${name} to position ${position} of ${total}.`);
    },
    announce: setAnnouncement,
  };
}
