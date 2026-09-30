import { expect, test, type Page } from "@playwright/test";
import { jpegWithExif, login } from "./helpers";

/**
 * Captures every admin screen at 1280 px and 390 px into screenshots/.
 * Skipped unless SCREENSHOTS=1 so normal runs don't rewrite committed PNGs.
 */
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture");

const WIDTHS = [1280, 390] as const;

async function shot(page: Page, name: string, width: number) {
  await page.evaluate(() => document.fonts.ready);
  // Full-page captures pin sticky elements mid-page; show the save bar at the end instead.
  await page.addStyleTag({ content: "[data-save-bar]{position:static!important}" });
  await page.screenshot({ path: `screenshots/${name}-${width}.png`, fullPage: true, animations: "disabled", caret: "hide" });
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: width > 500 ? 900 : 844 }, deviceScaleFactor: 1 });

    test(`admin screens at ${width}px`, async ({ page, context }) => {
      await page.goto("/admin/login");
      await shot(page, "01-login", width);
      await page.getByLabel("Password").fill("wrong password");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.locator("#login-error")).toBeVisible();
      await shot(page, "02-login-error", width);

      await login(page);
      await shot(page, "03-dashboard", width);

      for (const [i, key] of (["home", "about", "research", "contact", "site"] as const).entries()) {
        await page.goto(`/admin/${key}`);
        await shot(page, `${String(4 + i).padStart(2, "0")}-page-${key}`, width);
      }

      await page.goto("/admin/portfolio");
      await shot(page, "09-portfolio", width);
      await page.getByTestId("add-painting-file").setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: jpegWithExif() });
      await page.locator("#new-art-title").fill("Heron at dusk");
      await shot(page, "10-portfolio-add", width);
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.getByTestId("artwork-card").first().getByRole("button", { name: "Edit" }).click();
      await shot(page, "11-portfolio-edit", width);
      await page.getByTestId("artwork-card").nth(1).getByRole("button", { name: "Delete…" }).click();
      await page.screenshot({ path: `screenshots/12-portfolio-delete-confirm-${width}.png`, animations: "disabled" });

      // Unsaved-changes prompt.
      await page.goto("/admin/home");
      await page.getByLabel("Big title").fill(`Unsaved edit at ${width}px`);
      await page.getByRole("link", { name: "All pages" }).click();
      await page.screenshot({ path: `screenshots/13-unsaved-prompt-${width}.png`, animations: "disabled" });

      // Saved, then conflict from a second tab (viewport-only: the save bar is the point).
      await page.getByRole("button", { name: "Stay on this page" }).click();
      const other = await context.newPage();
      await other.setViewportSize({ width, height: width > 500 ? 900 : 844 });
      await other.goto("/admin/home");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByTestId("save-status")).toContainText("Saved");
      await page.screenshot({ path: `screenshots/14-saved-${width}.png`, animations: "disabled" });
      await other.getByLabel("Line under your name").fill("Edit from another tab");
      await other.getByRole("button", { name: "Save changes" }).click();
      await expect(other.getByTestId("save-status")).toContainText("changed in another tab");
      await other.screenshot({ path: `screenshots/15-conflict-${width}.png`, animations: "disabled" });
    });
  });
}
