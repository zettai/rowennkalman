/** Returns a copy of list with item i moved by delta (-1 up, +1 down). Out of range: unchanged. */
export function move<T>(list: readonly T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}
