import { execSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

/**
 * Signs a fresh user in through the real magic-link flow: request the link, then
 * read the dev token straight from Postgres and hit the verify endpoint (the same
 * origin as the app, so the session cookie lands where the SPA can use it).
 */
export async function signIn(page: Page, email: string): Promise<void> {
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

/** A per-test-unique address so parallel runs never collide on one user. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * Drives the profile wizard end-to-end with a valid answer set and lands on the
 * summary step (does NOT press Done). Assumes the page is already on /setup.
 */
export async function fillWizard(
  page: Page,
  answers: {
    birthYear?: string;
    sex?: string;
    heightCm?: string;
    weightKg?: string;
    activity?: RegExp;
  } = {},
): Promise<void> {
  const { birthYear = "1990", sex = "Male", heightCm = "180", weightKg = "80" } = answers;
  const activity = answers.activity ?? /On my feet a lot/;

  await page.getByLabel("Birth year", { exact: true }).selectOption(birthYear);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: sex, exact: true }).click();
  await page.getByLabel(/Height/).fill(heightCm);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel(/Weight/).fill(weightKg);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: activity }).click();

  await expect(page.getByTestId("step-summary")).toBeVisible();
}
