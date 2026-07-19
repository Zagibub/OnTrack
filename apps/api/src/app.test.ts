import { HealthResponseSchema } from "@ontrack/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

describe("GET /api/v1/health", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // AC-1 (001-project-skeleton)
  it("responds 200 with a body matching HealthResponseSchema", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });

    expect(res.statusCode).toBe(200);
    const parsed = HealthResponseSchema.safeParse(res.json());
    expect(parsed.success).toBe(true);
  });

  // AC-2 (001-project-skeleton)
  it("responds 404 with a JSON error body for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/does-not-exist" });

    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.json()).toHaveProperty("message");
  });
});
