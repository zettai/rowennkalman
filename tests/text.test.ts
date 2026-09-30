import { isEmailLike, trimEndChars } from "@/lib/text";

describe("isEmailLike", () => {
  it("accepts ordinary addresses and refuses obvious non-addresses", () => {
    for (const ok of ["a@b.co", "contact@example.com", "first.last+tag@sub.example.org"]) expect([ok, isEmailLike(ok)]).toEqual([ok, true]);
    for (const bad of ["", "nope", "@b.co", "a@", "a@b", "a@.co", "a@b.", "a b@c.co", "a@b@c.co"]) expect([bad, isEmailLike(bad)]).toEqual([bad, false]);
  });
  it("strict mode (contact form) refuses odd characters and one-letter endings", () => {
    expect(isEmailLike("a@b.co", { strict: true })).toBe(true);
    expect(isEmailLike('a"b@c.co', { strict: true })).toBe(false);
    expect(isEmailLike("a<b>@c.co", { strict: true })).toBe(false);
    expect(isEmailLike("a@b.c", { strict: true })).toBe(false);
    expect(isEmailLike("a@b.c")).toBe(true);
  });
  it("stays fast on worst-case input (the old regexes could backtrack)", () => {
    const evil = "a".repeat(50_000) + "@" + "a".repeat(50_000) + "!";
    const t = performance.now();
    isEmailLike(evil);
    isEmailLike(evil, { strict: true });
    expect(performance.now() - t).toBeLessThan(200);
  });
});

describe("trimEndChars", () => {
  it("removes only a trailing run of the given characters", () => {
    expect(trimEndChars("https://x.org///", "/")).toBe("https://x.org");
    expect(trimEndChars("word, ;.", ",;:. ")).toBe("word");
    expect(trimEndChars("a.b", ".")).toBe("a.b");
    expect(trimEndChars("", "/")).toBe("");
    expect(trimEndChars("x" + " ".repeat(100_000), " ")).toBe("x");
  });
});
