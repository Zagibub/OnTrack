import { expect, test } from "@playwright/test";

// 003: the theme toggle flips the resolved theme and persists the choice.
test("theme toggle switches to dark and survives a reload", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");

  // Under Playwright's default (light) color scheme, "system" leaves no override.
  await expect(html).not.toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
});

// 003: toggling back returns to light.
test("theme toggle switches back to light", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
});
