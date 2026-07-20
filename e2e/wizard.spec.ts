import { expect, test } from "@playwright/test";
import { fillWizard, signIn, uniqueEmail } from "./helpers";

// 005 §7: out-of-range height blocks Next and shows the range error; fixing it recovers.
test("wizard rejects an out-of-range height", async ({ page }) => {
  await signIn(page, uniqueEmail("wizard-height"));
  await expect(page).toHaveURL(/\/setup$/);

  await page.getByLabel("Birth year", { exact: true }).selectOption("1990");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Male", exact: true }).click();

  await page.getByLabel(/Height/).fill("500");
  await expect(page.getByText(/Enter a height between/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();

  await page.getByLabel(/Height/).fill("180");
  await expect(page.getByText(/Enter a height between/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
});

// 005 §7: same guard on weight.
test("wizard rejects an out-of-range weight", async ({ page }) => {
  await signIn(page, uniqueEmail("wizard-weight"));
  await expect(page).toHaveURL(/\/setup$/);

  await page.getByLabel("Birth year", { exact: true }).selectOption("1990");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Male", exact: true }).click();
  await page.getByLabel(/Height/).fill("180");
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByLabel(/Weight/).fill("5");
  await expect(page.getByText(/Enter a weight between/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();

  await page.getByLabel(/Weight/).fill("80");
  await expect(page.getByText(/Enter a weight between/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
});

// 005: the summary shows a computed TDEE baseline (Mifflin-St Jeor × activity factor).
test("wizard summary shows a plausible TDEE baseline", async ({ page }) => {
  await signIn(page, uniqueEmail("wizard-tdee"));
  await expect(page).toHaveURL(/\/setup$/);

  await fillWizard(page);

  const tdee = Number(await page.getByTestId("tdee-value").textContent());
  // Male 180cm 80kg, "on my feet a lot" → mid-2000s kcal; assert a sane range,
  // not an exact value (age drifts with the real current year).
  expect(tdee).toBeGreaterThan(1800);
  expect(tdee).toBeLessThan(3500);
});

// 005: editing an answer from the summary updates it and returns to the summary.
test("wizard summary lets you edit an answer", async ({ page }) => {
  await signIn(page, uniqueEmail("wizard-edit"));
  await expect(page).toHaveURL(/\/setup$/);

  await fillWizard(page, { weightKg: "80" });
  const before = Number(await page.getByTestId("tdee-value").textContent());

  // Tap the weight row → back on the weight step → change it → back to summary.
  await page.getByRole("button", { name: /Weight/ }).click();
  await expect(page.getByTestId("step-weight")).toBeVisible();
  await page.getByLabel(/Weight/).fill("95");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByTestId("step-summary")).toBeVisible();
  await expect(page.getByText("95 kg")).toBeVisible();
  const after = Number(await page.getByTestId("tdee-value").textContent());
  expect(after).toBeGreaterThan(before);
});
