"use client";

import { useEffect, useState } from "react";

/**
 * After an item moves, keep keyboard focus on the same button of the moved item
 * (or its sibling button when it reached the end), and announce the new position.
 */
export function useMoveFocus() {
  const [target, setTarget] = useState<{ id: string; action: "up" | "down" } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!target) return;
    const item = document.querySelector(`[data-item-id="${CSS.escape(target.id)}"]`);
    const preferred = item?.querySelector<HTMLButtonElement>(`[data-action="${target.action}"]`);
    const other = item?.querySelector<HTMLButtonElement>(`[data-action="${target.action === "up" ? "down" : "up"}"]`);
    (preferred && !preferred.disabled ? preferred : other)?.focus();
    setTarget(null);
  }, [target]);

  return {
    announcement,
    moved(id: string, action: "up" | "down", name: string, position: number, total: number) {
      setTarget({ id, action });
      setAnnouncement(`Moved ${name} to position ${position} of ${total}.`);
    },
    announce: setAnnouncement,
  };
}
