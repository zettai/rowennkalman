import { expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { E2E_DATA_DIR, E2E_EMAIL } from "../playwright.config";

/** The newest sign-in link the ConsoleLinkMailer wrote to the e2e outbox for this address. */
export function latestLoginLink(email = E2E_EMAIL): string | undefined {
  const file = path.join(E2E_DATA_DIR, "outbox", "login-links.jsonl");
  if (!existsSync(file)) return undefined;
  const lines = readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
  const mine = lines.map((l) => JSON.parse(l) as { to: string; url: string }).filter((m) => m.to === email);
  return mine.at(-1)?.url;
}

let cachedLink: string | undefined;

/**
 * Signs in the way an editor does: ask for a link, then open it. Links last 15 minutes and
 * addresses get at most 5 per 15 minutes, so the run asks once and reuses that link.
 */
export async function login(page: Page, next = "/admin") {
  if (!cachedLink) {
    await page.goto("/admin/login");
    const before = latestLoginLink();
    await page.getByLabel("Email address").fill(E2E_EMAIL);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("status")).toContainText("Check your email");
    await expect.poll(() => latestLoginLink()).not.toBe(before);
    cachedLink = latestLoginLink();
  }
  await page.goto(cachedLink!);
  await expect(page).toHaveURL(/\/admin$/);
  if (next !== "/admin") await page.goto(next);
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[/]/g, "\\/")}$`));
}

/** A real JPEG with an EXIF (APP1) segment, like a phone photo. The browser must strip it. */
export function jpegWithExif(): Buffer {
  const src = readFileSync(path.join(__dirname, "..", "content", "seed-images", "seed-art-3.jpg"));
  const exif = Buffer.from([0xff, 0xe1, 0x00, 0x0c, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d, 0x00, 0x2a]);
  return Buffer.concat([src.subarray(0, 2), exif, src.subarray(2)]);
}

export async function publicArtworkTitles(page: Page): Promise<string[]> {
  await page.goto("/portfolio");
  return page.getByTestId("artworks").getByTestId("artwork-title").allInnerTexts();
}
