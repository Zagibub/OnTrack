import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    // Pin locale so i18n resolves to English for text assertions.
    locale: "en-US",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      command: "docker compose up -d postgres && pnpm --filter @ontrack/api start:e2e",
      url: "http://localhost:3000/api/v1/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { APP_URL: "http://localhost:4173" },
    },
    {
      command: "pnpm --filter @ontrack/web build && pnpm --filter @ontrack/web serve:dist",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
