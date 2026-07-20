import { expect, test } from "@playwright/test";
import { fillWizard, signIn, uniqueEmail } from "./helpers";

// Block the PWA service worker so page.route mocks reach the app (the SW would
// otherwise intercept /api fetches and bypass our stubs).
test.use({ serviceWorkers: "block" });

async function reachToday(page: import("@playwright/test").Page, prefix: string): Promise<void> {
  await signIn(page, uniqueEmail(prefix));
  await expect(page).toHaveURL(/\/setup$/);
  await fillWizard(page);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/today$/);
}

// AC-9 (007/008): the Add chooser offers four methods; Describe is still a placeholder,
// Photo now opens the real photo flow (its disclaimer gate).
test("Add chooser shows four methods; Describe is a placeholder, Photo is live", async ({
  page,
}) => {
  await reachToday(page, "add-choose");

  await page.getByTestId("add-intake").click();
  await expect(page).toHaveURL(/\/add$/);

  for (const key of ["manual", "search", "describe", "photo"]) {
    await expect(page.getByTestId(`tile-${key}`)).toBeVisible();
  }

  await page.getByTestId("tile-describe").click();
  await expect(page).toHaveURL(/\/add\/describe$/);
  await expect(page.getByText("Coming soon")).toBeVisible();

  await page.goBack();
  await page.getByTestId("tile-photo").click();
  await expect(page).toHaveURL(/\/add\/photo$/);
  await expect(page.getByTestId("photo-disclaimer")).toBeVisible();
});

// A 502 from the food-search proxy means the upstream food database is down;
// the user should be told that specifically, not shown a generic error.
test("search shows a database-unavailable message on a 502", async ({ page }) => {
  await reachToday(page, "add-search-502");

  await page.route("**/api/v1/foods/search**", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ message: "Food search is unavailable right now" }),
    }),
  );

  await page.getByTestId("add-intake").click();
  await page.getByTestId("tile-search").click();
  await expect(page).toHaveURL(/\/add\/search$/);

  await page.getByLabel("Search").fill("banana");

  await expect(page.getByText("The food database is temporarily unavailable")).toBeVisible();
});

// AC-8 (007): logging a manual meal lifts the Intake headline on Today.
test("manual entry raises today's intake", async ({ page }) => {
  await reachToday(page, "add-manual");

  await expect(page.getByTestId("intake")).toContainText("0");

  await page.getByTestId("add-intake").click();
  await page.getByTestId("tile-manual").click();
  await expect(page).toHaveURL(/\/add\/manual$/);

  await page.getByLabel("Food").fill("Test meal");
  await page.getByLabel(/Calories/).fill("500");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByTestId("intake")).toContainText("500");
});
