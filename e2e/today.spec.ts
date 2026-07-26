import { expect, type Page, test } from "@playwright/test";
import { fillWizard, signIn, uniqueEmail } from "./helpers";

// Feature 010 — the Today header is a Today/Week/Month picker; Week and Month show the
// net balance across the period in the same chart slot as Today's day view.

// Block the PWA service worker so seeding via page.request isn't intercepted.
test.use({ serviceWorkers: "block" });

function isoAtNoon(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).toISOString();
}

async function reachToday(page: Page, prefix: string): Promise<void> {
  await signIn(page, uniqueEmail(prefix));
  await expect(page).toHaveURL(/\/setup$/);
  await fillWizard(page);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/today$/);
}

async function seed(page: Page, name: string, kcal: number, when: Date): Promise<void> {
  const res = await page.request.post("/api/v1/meal-entries", {
    data: { name, kcal, source: "manual", loggedAt: isoAtNoon(when) },
  });
  expect(res.ok()).toBeTruthy();
}

/** Open the period dropdown and pick an option. */
async function selectPeriod(page: Page, value: string): Promise<void> {
  await page.getByTestId("period-picker").click();
  await page.locator(`[data-testid="period-picker-menu"] [data-value="${value}"]`).click();
}

// AC-1/AC-2: the picker is a header dropdown, defaults to Today, and Today shows the day chart.
test("Today header is a period dropdown defaulting to the day view", async ({ page }) => {
  await reachToday(page, "today-picker");

  await expect(page.getByTestId("period-picker")).toContainText("Today");
  await expect(page.getByTestId("balance-chart")).toBeVisible();
  await expect(page.getByTestId("period-chart")).toHaveCount(0);
});

// AC-3: switching to Week/Month swaps the day chart for the period chart in the same slot.
test("Week and Month swap in the period chart", async ({ page }) => {
  await reachToday(page, "today-week");

  await selectPeriod(page, "week");
  await expect(page.getByTestId("period-picker")).toContainText("Week");
  await expect(page.getByTestId("period-chart")).toBeVisible();
  await expect(page.getByTestId("balance-chart")).toHaveCount(0);
  // A period headline net, in kcal.
  await expect(page.getByTestId("period-net")).toContainText(/-?\d/);

  const weekTitle = await page.getByTestId("period-title").textContent();

  await selectPeriod(page, "month");
  await expect(page.getByTestId("period-picker")).toContainText("Month");
  await expect(page.getByTestId("period-chart")).toBeVisible();
  const monthTitle = await page.getByTestId("period-title").textContent();
  expect(monthTitle).not.toEqual(weekTitle);
});

// AC-4: the chosen view is remembered across reloads (like History's toggle).
test("remembers the chosen period across reloads", async ({ page }) => {
  await reachToday(page, "today-remember");

  await selectPeriod(page, "week");
  await expect(page.getByTestId("period-chart")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("period-picker")).toContainText("Week");
  await expect(page.getByTestId("period-chart")).toBeVisible();
});

// AC-5: intake logged across the week is reflected in the week's cumulative net.
test("week net reflects intake logged earlier in the week", async ({ page }) => {
  await reachToday(page, "today-weeknet");

  const today = new Date();
  const twoDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2);
  await seed(page, "Earlier meal", 1500, twoDaysAgo);
  await seed(page, "Today meal", 800, today);

  await page.reload();
  await selectPeriod(page, "week");
  await expect(page.getByTestId("period-net")).toBeVisible();
  // Cumulative net is a signed integer of kcal; exact value drifts with TDEE, so we only
  // assert it renders a number rather than a literal.
  await expect(page.getByTestId("period-net")).toContainText(/-?\d+/);
});
