import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import { E2E_DATA_DIR } from "../playwright.config";
import { jpegWithExif, latestLoginLink, login, publicArtworkTitles } from "./helpers";

test("sign-in: admin is protected, only allowed addresses get a link, the link signs in", async ({ page, request }) => {
  await page.goto("/admin/home");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fhome$/);
  expect((await request.get("/api/admin/content")).status()).toBe(401);

  // An address that may not sign in gets the same answer, and no link is written.
  const before = latestLoginLink("stranger@example.net");
  await page.getByLabel("Email address").fill("stranger@example.net");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  expect(latestLoginLink("stranger@example.net")).toBe(before);

  // A broken or expired link says so and asks for a new one.
  await page.goto("/api/auth/magic-link?token=not-a-real-token");
  await expect(page.locator("#login-error")).toContainText("expired");

  await login(page, "/admin/home");
  const cookie = (await page.context().cookies()).find((c) => c.name === "rk_admin_session");
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax" });
});

test("edit home.heroTitle, save, see it on /", async ({ page }) => {
  await login(page, "/admin/home");
  const title = `Heron season ${Date.now()}`;
  await page.getByLabel("Big title").fill(title);
  await expect(page.getByTestId("save-status")).toContainText("unsaved changes");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("save-status")).toContainText("Saved. Your changes are live");
  await page.goto("/");
  await expect(page.getByTestId("hero-title")).toHaveText(title);
});

test("add an artwork, move it up, see the order on /portfolio, delete it and its image", async ({ page, request }) => {
  await login(page, "/admin/portfolio");
  const before = await page.getByTestId("artwork-card").count();
  await page.getByTestId("add-painting-file").setInputFiles({ name: "phone-photo.jpg", mimeType: "image/jpeg", buffer: jpegWithExif() });
  const title = `E2E Heron ${Date.now()}`;
  await page.locator("#new-art-title").fill(title);
  await page.locator("#new-art-medium").fill("Acrylic on panel");
  await page.getByLabel("Picture description").fill("Test heron");
  await page.getByRole("button", { name: "Add to portfolio" }).click();
  await expect(page.getByTestId("artwork-card")).toHaveCount(before + 1);

  const card = page.getByTestId("artwork-card").last();
  await expect(card).toContainText(title);
  const src = await card.locator("img").getAttribute("src");
  const key = src!.replace("/api/dev-images/", "");
  expect(key).toMatch(/^art\/[0-9a-f-]{36}\.jpg$/);

  await page.getByRole("button", { name: `Move “${title}” up` }).click();
  await expect(page.getByTestId("artwork-card").nth(before - 1)).toContainText(title);
  // Focus stays on the moved item's Up button for keyboard users.
  await expect(page.getByRole("button", { name: `Move “${title}” up` })).toBeFocused();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("save-status")).toContainText("Saved");
  // The browser made a tiny blurred preview for the loading state and it was saved with the picture.
  const saved = (await (await page.request.get("/api/admin/content")).json()) as { content?: { portfolio: { artworks: { title: string; image: { blur?: string } }[] } } };
  const savedArt = (saved.content ?? (saved as never as NonNullable<typeof saved.content>)).portfolio.artworks.find((a) => a.title === title);
  expect(savedArt?.image.blur).toMatch(/^data:image\/jpeg;base64,/);
  expect(savedArt!.image.blur!.length).toBeLessThan(2000);

  // The stored image is a clean JPEG (EXIF stripped by the browser, re-checked by the server).
  const img = await request.get(src!);
  expect(img.status()).toBe(200);
  const bytes = await img.body();
  expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  expect(bytes.includes(Buffer.from("Exif"))).toBe(false);

  const titles = await publicArtworkTitles(page);
  expect(titles).toHaveLength(before + 1);
  expect(titles[before - 1]).toBe(title);

  // Delete it (inline confirm), save, and the image key is gone.
  await page.goto("/admin/portfolio");
  const mine = page.getByTestId("artwork-card").filter({ hasText: title });
  await mine.getByRole("button", { name: "Delete…" }).click();
  await mine.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByTestId("artwork-card")).toHaveCount(before);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("save-status")).toContainText("Saved");
  expect(existsSync(path.join(E2E_DATA_DIR, key))).toBe(false);
  expect((await request.get(src!)).status()).toBe(404);
  expect(await publicArtworkTitles(page)).not.toContain(title);
});

test("two tabs: the second save gets the conflict message", async ({ page, context }) => {
  await login(page, "/admin/home");
  const other = await context.newPage();
  await other.goto("/admin/home");

  await page.getByLabel("Big title").fill(`Tab A ${Date.now()}`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("save-status")).toContainText("Saved");

  await other.getByLabel("Line under your name").fill("Tab B edit");
  await other.getByRole("button", { name: "Save changes" }).click();
  await expect(other.getByTestId("save-status")).toContainText("This page was changed in another tab. Reload to see the latest.");
  // Reload brings the latest, including tab A's title.
  await other.getByRole("button", { name: "Reload" }).click();
  await expect(other.getByLabel("Big title")).toHaveValue(/^Tab A/);
});

test("HEIC is refused with a friendly message; nothing is uploaded", async ({ page }) => {
  await login(page, "/admin/home");
  await page.getByText("Replace picture").first().waitFor();
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles({ name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: Buffer.from("....ftypheic") });
  await expect(page.getByText("iPhone HEIC photos can't be used directly")).toBeVisible();
  await expect(page.getByTestId("save-status")).toContainText("All changes are saved");
});

test("unsaved changes: leaving asks in the page first", async ({ page }) => {
  await login(page, "/admin/about");
  await page.getByLabel("Page title").fill("About me");
  await page.getByRole("link", { name: "All pages" }).click();
  await expect(page.getByText("You have unsaved changes", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stay on this page" })).toBeFocused();
  await page.getByRole("button", { name: "Stay on this page" }).click();
  await expect(page).toHaveURL(/\/admin\/about$/);
  await expect(page.getByLabel("Page title")).toHaveValue("About me");
  await page.getByRole("link", { name: "All pages" }).click();
  await page.getByRole("button", { name: "Leave without saving" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("image fields: replace the home picture, change alt text, remove it", async ({ page, request }) => {
  await login(page, "/admin/home");
  const oldSrc = await page.locator("img").first().getAttribute("src");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "hero.jpg", mimeType: "image/jpeg", buffer: jpegWithExif() });
  await expect(page.locator("img").first()).not.toHaveAttribute("src", oldSrc!);
  await page.getByLabel("Picture description").fill("New hero");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("save-status")).toContainText("Saved");
  expect((await request.get(oldSrc!)).status()).toBe(404); // replaced image's key deleted
  const newSrc = await page.locator("img").first().getAttribute("src");
  await page.getByRole("button", { name: "Remove picture" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("save-status")).toContainText("Saved");
  expect((await request.get(newSrc!)).status()).toBe(404);
  await expect(page.getByText("No picture yet")).toBeVisible();
});

test("sign out clears the session", async ({ page, request }) => {
  await login(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login\?signedOut=1$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await request.get("/api/admin/content")).status()).toBe(401);
});

test("contact API: honeypot pretends success, too-fast is refused, valid is accepted", async ({ request }) => {
  const base = { name: "Test", email: "test@example.com", message: "Hello", website: "" };
  const pot = await request.post("/api/contact", { data: { ...base, website: "spam", startedAt: Date.now() - 10_000 } });
  expect(pot.status()).toBe(200);
  const fast = await request.post("/api/contact", { data: { ...base, startedAt: Date.now() } });
  expect(fast.status()).toBe(400);
  const ok = await request.post("/api/contact", { data: { ...base, startedAt: Date.now() - 10_000 } });
  expect(await ok.json()).toEqual({ ok: true }); // ConsoleMailer: no key configured
});
