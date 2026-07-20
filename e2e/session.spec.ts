import { expect, test } from "@playwright/test";
import { fillWizard, signIn, uniqueEmail } from "./helpers";

// 004: signing out clears the session — back to landing, and /today is guarded again.
test("a signed-in user can sign out", async ({ page }) => {
  await signIn(page, uniqueEmail("signout"));

  // New user → finish setup so we land on the real dashboard.
  await expect(page).toHaveURL(/\/setup$/);
  await fillWizard(page);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/today$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "OnTrack" })).toBeVisible();

  // Session is gone: the guard bounces a direct /today visit to sign-in.
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in$/);
});
