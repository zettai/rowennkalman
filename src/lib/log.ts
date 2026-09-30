/**
 * One JSON line per event, so Netlify's function log can be searched and read by a script.
 * Values are the site's own public text; never pass secrets or tokens.
 */
export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  console.info(JSON.stringify({ at: new Date().toISOString(), event, ...fields }));
}

/** Dotted paths whose value differs between two JSON-like values (for "which fields changed"). */
export function changedPaths(before: unknown, after: unknown, prefix = ""): string[] {
  if (before === after) return [];
  const isObj = (v: unknown) => v !== null && typeof v === "object";
  if (!isObj(before) || !isObj(after) || Array.isArray(before) !== Array.isArray(after)) return [prefix || "(root)"];
  const a = before as Record<string, unknown>, b = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].flatMap((k) => changedPaths(a[k], b[k], prefix ? `${prefix}.${k}` : k));
}
