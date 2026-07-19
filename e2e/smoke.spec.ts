import { expect, test } from "@playwright/test";

// AC-6 (001-project-skeleton)
test("shows app name and connected API status on a mobile viewport", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "OnTrack" })).toBeVisible();
  await expect(page.getByTestId("api-status")).toHaveText("API connected");
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
