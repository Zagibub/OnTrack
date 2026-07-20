import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { fillWizard, signIn, uniqueEmail } from "./helpers";

// Playwright runs from the repo root; keep the fixture path cwd-relative (no import.meta).
const FIXTURE = path.join(process.cwd(), "e2e/fixtures/meal.png");

// Block the PWA service worker so page.route mocks reach the app (the SW would
// otherwise intercept /api fetches and bypass our stubs).
test.use({ serviceWorkers: "block" });

const PROPOSAL = {
  items: [
    { name: "Grilled chicken", kcal: 330, grams: 165, portion: "1 breast" },
    { name: "Rice", kcal: 210, grams: 150, portion: "1 cup" },
  ],
};

async function reachToday(page: Page, prefix: string): Promise<void> {
  await signIn(page, uniqueEmail(prefix));
  await expect(page).toHaveURL(/\/setup$/);
  await fillWizard(page);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/today$/);
}

async function openPhoto(page: Page): Promise<void> {
  await page.getByTestId("add-intake").click();
  await page.getByTestId("tile-photo").click();
  await expect(page).toHaveURL(/\/add\/photo$/);
}

// AC-8 (008): first-time disclaimer → upload → confirm proposed items → Today intake rises.
// The vision call is mocked (no live OpenRouter/camera in CI); consent + save hit the real API.
test("photo flow: accept disclaimer, analyse, confirm, save raises intake", async ({ page }) => {
  await reachToday(page, "photo-happy");

  await page.route("**/api/v1/photo/analyze", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PROPOSAL) }),
  );

  await openPhoto(page);

  // The content disclaimer gates the first upload.
  await expect(page.getByTestId("photo-disclaimer")).toBeVisible();
  await page.getByTestId("accept-disclaimer").click();

  // Upload a photo → the (mocked) proposal renders as editable items.
  await page.getByTestId("photo-input").setInputFiles(FIXTURE);
  await expect(page.getByTestId("item-name-0")).toHaveValue("Grilled chicken");
  await expect(page.getByTestId("item-name-1")).toHaveValue("Rice");
  await expect(page.getByTestId("photo-total")).toContainText("540");

  // Switch item 0 to grams (density 330/165 = 2 kcal/g): the value becomes 165 g.
  await page.getByTestId("item-unit-g-0").click();
  await expect(page.getByTestId("item-value-0")).toHaveValue("165");
  // Change to 200 g → 400 kcal; total = 400 + 210 = 610.
  await page.getByTestId("item-value-0").fill("200");
  await expect(page.getByTestId("photo-total")).toContainText("610");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByTestId("intake")).toContainText("610");
});

// AC-9 (008): hitting the daily quota shows a specific "limit reached" message.
test("photo flow: over-quota analysis shows the limit message", async ({ page }) => {
  await reachToday(page, "photo-quota");

  await page.route("**/api/v1/photo/analyze", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ message: "Daily photo analysis limit reached" }),
    }),
  );

  await openPhoto(page);
  await page.getByTestId("accept-disclaimer").click();
  await page.getByTestId("photo-input").setInputFiles(FIXTURE);

  await expect(page.getByTestId("photo-error")).toContainText("reached today's photo limit");
});
