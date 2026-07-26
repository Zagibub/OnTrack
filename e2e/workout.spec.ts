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
  // The wizard's default answers include 80 kg, which the kcal estimate reads.
  await fillWizard(page);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/today$/);
}

/** Seed a workout through the API using the browser's session cookie; returns its id. */
async function seedWorkout(
  page: Page,
  activity: string,
  durationMin: number,
  kcal: number,
  when: Date,
): Promise<number> {
  const res = await page.request.post("/api/v1/exercise-entries", {
    data: { activity, name: null, durationMin, kcal, loggedAt: isoAtNoon(when) },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id as number;
}

// AC-11: the Add activity action logs a workout, and Today's headline figures follow.
test("logs a workout from Today and updates the activity and net figures", async ({ page }) => {
  await reachToday(page, "workout-today");

  // Today starts with no logged burn; remember the net so we can see it drop.
  await expect(page.getByTestId("activity")).toHaveText("0");
  const netBefore = Number((await page.getByTestId("net").textContent())?.replace("+", ""));

  await page.getByTestId("add-activity").click();
  await expect(page).toHaveURL(/\/add\/workout$/);

  // Activity → Running, duration 45 min. kcal pre-fills from the MET estimate.
  await page.getByTestId("activity-type").click();
  await page.locator('[data-testid="activity-type-menu"] [data-value="running"]').click();
  // Picking an option closes the menu and leaves the choice on the trigger.
  await expect(page.getByTestId("activity-type-menu")).toHaveCount(0);
  await expect(page.getByTestId("activity-type")).toContainText("Running");

  await page.getByLabel(/Duration/).fill("45");

  // 80 kg × running (MET 9.8) × 45 min ⇒ round((9.8 − 1) × 3.5 × 80 / 200 × 45) = 554.
  await expect(page.getByLabel(/Calories burned/)).toHaveValue("554");
  await expect(page.getByTestId("kcal-hint")).toBeVisible();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/today$/);

  // The burn lands on the Activity headline and pulls Net down by at least as much.
  // "At least": the baseline expenditure also accrues by the minute while the test runs,
  // so pinning the difference to exactly 554 would flake on a minute boundary.
  await expect(page.getByTestId("activity")).toHaveText("554");
  const netAfter = Number((await page.getByTestId("net").textContent())?.replace("+", ""));
  expect(netAfter).toBeLessThanOrEqual(netBefore - 554);
});

// AC-11 (cont.): a manually typed figure outranks the estimate, and clearing resumes it.
test("keeps a manually entered kcal figure over the estimate", async ({ page }) => {
  await reachToday(page, "workout-manual");

  await page.getByTestId("add-activity").click();
  await page.getByTestId("activity-type").click();
  await page.locator('[data-testid="activity-type-menu"] [data-value="cycling"]').click();
  await page.getByLabel(/Duration/).fill("30");

  const kcal = page.getByLabel(/Calories burned/);
  await expect(kcal).not.toHaveValue("");

  // Type a watch reading, then change the duration — the manual value survives.
  await kcal.fill("321");
  await page.getByLabel(/Duration/).fill("60");
  await expect(kcal).toHaveValue("321");
  // The hint retires once the field is the user's.
  await expect(page.getByTestId("kcal-hint")).toHaveCount(0);

  // Clearing hands ownership back and the estimate refills.
  await kcal.fill("");
  await expect(kcal).not.toHaveValue("");
  await expect(kcal).not.toHaveValue("321");
});

// AC-12: the workout shows as an amber activity day, lists with its duration, and
// deletes with undo.
test("shows workouts in History and deletes them with undo", async ({ page }) => {
  await reachToday(page, "workout-history");

  const today = new Date();
  const id = await seedWorkout(page, "swimming", 40, 420, today);

  await page.getByTestId("show-entries").click();
  await expect(page).toHaveURL(/\/history$/);

  // The month cell flags the day as having activity — and no intake, nothing was eaten.
  await expect(page.getByTestId("view-month")).toBeVisible();
  await expect(page.getByTestId(`day-cell-${dayKey(today)}`)).toHaveAttribute(
    "data-activity",
    "true",
  );
  await expect(page.getByTestId(`day-cell-${dayKey(today)}`)).toHaveAttribute(
    "data-intake",
    "false",
  );

  // The day log lists the row under the activity's name, with its duration in the sub-label.
  await page.getByTestId(`day-cell-${dayKey(today)}`).click();
  await expect(page.getByTestId("view-day")).toBeVisible();
  const row = page.getByTestId(`workout-${id}`);
  await expect(row).toBeVisible();
  await expect(row).toContainText("Swimming");
  await expect(row).toContainText("40 min");
  await expect(row).toContainText("420");

  // Delete (the affordance is revealed by swipe; force-click it directly in the test).
  await page.getByTestId(`delete-workout-${id}`).dispatchEvent("click");
  await expect(row).toHaveCount(0);
  await expect(page.getByTestId("undo-delete")).toBeVisible();

  // Undo restores it.
  await page.getByTestId("undo-delete").click();
  await expect(row).toBeVisible();

  // Delete again, let the window lapse, and confirm it's really gone after a reload.
  await page.getByTestId(`delete-workout-${id}`).dispatchEvent("click");
  await expect(page.getByTestId("undo-delete")).toBeVisible();
  await expect(page.getByTestId("undo-delete")).toHaveCount(0, { timeout: 8000 });

  await page.reload();
  await expect(page.getByTestId("view-day")).toBeVisible();
  await expect(page.getByTestId(`workout-${id}`)).toHaveCount(0);
  await expect(page.getByTestId("day-empty")).toBeVisible();
});

// The activity action in History carries the viewed day back, so the round trip returns
// to the day you left rather than Today.
test("History's add-activity action returns to the day it was pressed from", async ({ page }) => {
  await reachToday(page, "workout-from");

  await page.getByTestId("show-entries").click();
  await page.locator('[data-testid="view-toggle"] [data-value="day"]').click();
  await expect(page.getByTestId("view-day")).toBeVisible();

  await page.getByTestId("history-add-activity").click();
  await expect(page).toHaveURL(/\/add\/workout\?from=/);

  await page.getByTestId("activity-type").click();
  await page.locator('[data-testid="activity-type-menu"] [data-value="yoga"]').click();
  await page.getByLabel(/Duration/).fill("20");
  await page.getByRole("button", { name: "Save" }).click();

  // Straight back to the history day, with the new row on it.
  await expect(page).toHaveURL(/\/history\?g=day/);
  await expect(page.getByTestId("view-day")).toBeVisible();
  await expect(page.getByText("Yoga")).toBeVisible();
});
