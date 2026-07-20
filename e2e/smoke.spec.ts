import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";

/**
 * Signs a fresh user in through the real magic-link flow: request the link, then
 * read the dev token straight from Postgres and hit the verify endpoint (the same
 * origin as the app, so the session cookie lands where the SPA can use it).
 */
async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Send me a link" }).click();
  await expect(page.getByTestId("sent-state")).toContainText("Check your inbox");

  const token = execSync(
    `docker compose exec -T postgres psql -U ontrack -d ontrack -tA -c ` +
      `"SELECT identifier FROM verification WHERE value LIKE '%${email}%' ORDER BY created_at DESC LIMIT 1"`,
    { encoding: "utf8" },
  ).trim();
  if (!token) throw new Error(`no verification token found for ${email}`);

  await page.goto(`/api/auth/magic-link/verify?token=${token}&callbackURL=/today`);
}

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

// AC-7 (005): guard sends signed-out users off the wizard
test("visiting /setup signed out redirects to sign-in", async ({ page }) => {
  await page.goto("/setup");

  await expect(page).toHaveURL(/\/sign-in$/);
});

// AC-7 (005): fresh user → wizard → /today, and reload stays on /today
test("a new user completes the setup wizard and lands on today", async ({ page }) => {
  await signIn(page, `wizard-${Date.now()}@example.com`);

  // No profile yet → routed into the wizard.
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByTestId("step-birthYear")).toBeVisible();

  await page.getByLabel("Birth year", { exact: true }).selectOption("1990");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Male", exact: true }).click();
  await page.getByLabel(/Height/).fill("180");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel(/Weight/).fill("80");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /On my feet a lot/ }).click();

  await expect(page.getByTestId("step-summary")).toBeVisible();
  await expect(page.getByTestId("tdee-value")).not.toBeEmpty();
  await page.getByRole("button", { name: "Done" }).click();

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  // Profile now exists → reload goes straight to /today, not the wizard.
  await page.reload();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
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
