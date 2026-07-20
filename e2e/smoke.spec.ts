import { expect, test } from "@playwright/test";

// AC-6 (001-project-skeleton), amended by 003: no API status in the UI
test("shows the onboarding screen on a mobile viewport", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "OnTrack" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
});

// AC-5 (003-onboarding), amended by 004: sign-in comes first
test("Get started leads to the sign-in screen", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Get started" }).click();

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

// AC-7 (004)
test("requesting a magic link shows the confirmation state", async ({ page }) => {
  await page.goto("/sign-in");

  const email = `e2e-${Date.now()}@example.com`;
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Send me a link" }).click();

  await expect(page.getByTestId("sent-state")).toContainText("Check your inbox");
  await expect(page.getByTestId("sent-state")).toContainText(email);
});

// AC-5 (004): guard
test("visiting /today signed out redirects to sign-in", async ({ page }) => {
  await page.goto("/today");

  await expect(page).toHaveURL(/\/sign-in$/);
});

// AC-7 (001-project-skeleton)
test("links a web app manifest and registers a service worker", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest/);

  // The SW registers on app stability (registerWhenStable), which can trail first
  // paint by a beat — poll rather than snapshot.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration !== undefined;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
});
