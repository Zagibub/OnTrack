import { expect, test } from "@playwright/test";

// AC-6 (001-project-skeleton), amended by 003: no API status in the UI
test("shows the onboarding screen on a mobile viewport", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "OnTrack" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
});

// AC-5 (003-onboarding)
test("Get started leads to the dashboard placeholder", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Get started" }).click();

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});

// AC-7 (001-project-skeleton)
test("links a web app manifest and registers a service worker", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest/);

  const swRegistered = await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration !== undefined;
  });
  expect(await swRegistered.jsonValue()).toBe(true);
});
