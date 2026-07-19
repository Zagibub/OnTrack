import { describe, expect, it } from "vitest";
import { HealthResponseSchema } from "./index.js";

// AC-3 (001-project-skeleton)
describe("HealthResponseSchema", () => {
  it("accepts a valid health response", () => {
    const result = HealthResponseSchema.safeParse({ status: "ok", version: "0.1.0" });
    expect(result.success).toBe(true);
  });

  it("rejects a response whose status is not 'ok'", () => {
    const result = HealthResponseSchema.safeParse({ status: "down", version: "0.1.0" });
    expect(result.success).toBe(false);
  });

  it("rejects a response without a version", () => {
    const result = HealthResponseSchema.safeParse({ status: "ok" });
    expect(result.success).toBe(false);
  });
});
