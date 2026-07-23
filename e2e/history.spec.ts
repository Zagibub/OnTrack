import { expect, type Page, test } from "@playwright/test";
import { fillWizard, signIn, uniqueEmail } from "./helpers";

// Block the PWA service worker so seeding via page.request isn't intercepted.
test.use({ serviceWorkers: "block" });

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Local-noon ISO instant on the given date (noon keeps the local day unambiguous). */
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

/** Seed a meal entry through the API using the browser's session cookie; returns its id. */
async function seed(page: Page, name: string, kcal: number, when: Date): Promise<number> {
  const res = await page.request.post("/api/v1/meal-entries", {
    data: { name, kcal, source: "manual", loggedAt: isoAtNoon(when) },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id as number;
}

async function openHistory(page: Page): Promise<void> {
  await page.getByTestId("show-entries").click();
  await expect(page).toHaveURL(/\/history$/);
}

// AC-11 / AC-12: entry point opens the month view; the toggle choice is remembered.
test("opens the calendar and remembers the chosen view", async ({ page }) => {
  await reachToday(page, "history-open");
  await openHistory(page);
  await expect(page.getByTestId("view-month")).toBeVisible();

  await page.locator('[data-testid="view-toggle"] [data-value="week"]').click();
  await expect(page.getByTestId("view-week")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("view-week")).toBeVisible();
});

// AC-14 / AC-13: days flag which entry types they have (intake dot), and month→day drills down.
test("flags entry types on days and drills month → day", async ({ page }) => {
  await reachToday(page, "history-drill");

  const now = new Date();
  const mealDay = new Date(now.getFullYear(), now.getMonth(), 12);
  await seed(page, "Feast", 3500, mealDay);

  await openHistory(page);
  await expect(page.getByTestId("view-month")).toBeVisible();

  // The day with a meal shows the intake flag; a day with no entries does not.
  await expect(page.getByTestId(`day-cell-${dayKey(mealDay)}`)).toHaveAttribute(
    "data-intake",
    "true",
  );
  const emptyDay = new Date(now.getFullYear(), now.getMonth(), 6);
  await expect(page.getByTestId(`day-cell-${dayKey(emptyDay)}`)).toHaveAttribute(
    "data-intake",
    "false",
  );

  // Month → tap the day → straight to the day view, which lists the entry.
  await page.getByTestId(`day-cell-${dayKey(mealDay)}`).click();
  await expect(page.getByTestId("view-day")).toBeVisible();
  await expect(page.getByText("Feast")).toBeVisible();
});

// The week view shows a net balance for past/today but never for future days.
test("week view shows net for elapsed days and hides it for future days", async ({ page }) => {
  await reachToday(page, "history-future");
  const today = new Date();
  await seed(page, "Lunch", 500, today);

  await openHistory(page);
  await page.locator('[data-testid="view-toggle"] [data-value="week"]').click();
  await expect(page.getByTestId("view-week")).toBeVisible();

  // Today's net is shown.
  await expect(page.getByTestId(`week-day-net-${dayKey(today)}`)).toBeVisible();

  // The next week is entirely in the future → no day shows a net.
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.locator('[data-testid^="week-day-net-"]')).toHaveCount(0);
});

// AC-15 / AC-16: edit an entry's fields, then move it to another day.
test("edits an entry and can move it to another day", async ({ page }) => {
  await reachToday(page, "history-edit");
  const today = new Date();
  await seed(page, "Lunch", 500, today);

  await openHistory(page);
  await page.locator('[data-testid="view-toggle"] [data-value="day"]').click();
  await expect(page.getByTestId("view-day")).toBeVisible();

  // Edit name + kcal.
  await page.getByText("Lunch").click();
  const editor = page.getByTestId("entry-editor");
  await expect(editor).toBeVisible();
  const textInputs = editor.locator('input[type="text"]');
  await textInputs.nth(0).fill("Big lunch");
  await textInputs.nth(1).fill("900");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Big lunch")).toBeVisible();

  // Move it to yesterday via the date field.
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  await page.getByText("Big lunch").click();
  await page.getByTestId("edit-date").fill(dayKey(yesterday));
  await page.getByRole("button", { name: "Save" }).click();

  // Gone from today…
  await expect(page.getByTestId("day-empty")).toBeVisible();
  // …present on the previous day.
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page.getByText("Big lunch")).toBeVisible();
});

// AC-17: delete shows an undo snackbar; undo restores; letting it lapse persists the delete.
test("deletes an entry with undo", async ({ page }) => {
  await reachToday(page, "history-delete");
  const today = new Date();
  const keepId = await seed(page, "Keeper", 300, today);
  const dropId = await seed(page, "Goner", 400, today);

  await openHistory(page);
  await page.locator('[data-testid="view-toggle"] [data-value="day"]').click();
  await expect(page.getByTestId(`entry-${dropId}`)).toBeVisible();

  // Delete (the affordance is revealed by swipe; force-click it directly in the test).
  await page.getByTestId(`delete-entry-${dropId}`).dispatchEvent("click");
  await expect(page.getByTestId(`entry-${dropId}`)).toHaveCount(0);
  await expect(page.getByTestId("undo-delete")).toBeVisible();

  // Undo restores it.
  await page.getByTestId("undo-delete").click();
  await expect(page.getByTestId(`entry-${dropId}`)).toBeVisible();

  // Delete again and let the undo window lapse, then confirm it's really gone.
  await page.getByTestId(`delete-entry-${dropId}`).dispatchEvent("click");
  await expect(page.getByTestId("undo-delete")).toBeVisible();
  await expect(page.getByTestId("undo-delete")).toHaveCount(0, { timeout: 8000 });

  await page.reload();
  await page.locator('[data-testid="view-toggle"] [data-value="day"]').click();
  await expect(page.getByTestId(`entry-${keepId}`)).toBeVisible();
  await expect(page.getByTestId(`entry-${dropId}`)).toHaveCount(0);
});
