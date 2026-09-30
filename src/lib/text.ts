// Small string checks written as plain loops: linear time on any input, so there is no
// regular-expression backtracking to worry about (SonarQube hotspot S5852).

const FORBIDDEN_IN_STRICT_EMAIL = new Set(["<", ">", "(", ")", "[", "]", "\\", ",", ";", ":", '"']);

/**
 * A pragmatic email check: one "@", something before it, a domain with a dot that has text on
 * both sides, and no spaces. `strict` (the contact form) also refuses characters that don't
 * belong in addresses people type and asks for at least two letters after the last dot.
 */
export function isEmailLike(value: string, options: { strict?: boolean } = {}): boolean {
  for (const ch of value) {
    if (/\s/.test(ch)) return false; // one character at a time: no backtracking
    if (options.strict && FORBIDDEN_IN_STRICT_EMAIL.has(ch)) return false;
  }
  const at = value.indexOf("@");
  if (at < 1 || at !== value.lastIndexOf("@")) return false;
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  if (dot < 1) return false;
  const tail = domain.length - dot - 1;
  return options.strict ? tail >= 2 : tail >= 1;
}

/** Removes any run of the given characters from the end of the text. */
export function trimEndChars(value: string, chars: string): string {
  let end = value.length;
  while (end > 0 && chars.includes(value[end - 1]!)) end--;
  return value.slice(0, end);
}
