import { describe, expect, it } from "vitest";
import {
  ACTIVITY_FACTORS,
  ageFromBirthYear,
  calculateBmr,
  calculateTdee,
  makeUpsertProfileSchema,
} from "./profile.js";

// AC-1 (005): Mifflin-St Jeor reference values.
describe("calculateBmr", () => {
  const common = { weightKg: 80, heightCm: 180, age: 30 };

  it("matches the male reference value", () => {
    expect(calculateBmr({ ...common, sex: "male" })).toBe(1780);
  });

  it("matches the female reference value", () => {
    expect(calculateBmr({ ...common, sex: "female" })).toBe(1614);
  });

  it("averages both formulas for 'unspecified'", () => {
    expect(calculateBmr({ ...common, sex: "unspecified" })).toBe((1780 + 1614) / 2);
  });

  it("rejects zero or negative input", () => {
    expect(() => calculateBmr({ ...common, weightKg: 0, sex: "male" })).toThrow(RangeError);
    expect(() => calculateBmr({ ...common, heightCm: -1, sex: "male" })).toThrow(RangeError);
    expect(() => calculateBmr({ ...common, age: 0, sex: "male" })).toThrow(RangeError);
  });
});

describe("calculateTdee", () => {
  const base = { weightKg: 80, heightCm: 180, age: 30, sex: "male" } as const;

  it("multiplies BMR by the factor for every activity level", () => {
    for (const [level, factor] of Object.entries(ACTIVITY_FACTORS)) {
      expect(
        calculateTdee({ ...base, activityLevel: level as keyof typeof ACTIVITY_FACTORS }),
      ).toBe(Math.round(1780 * factor));
    }
  });
});

describe("ageFromBirthYear", () => {
  it("subtracts birth year from the reference year", () => {
    expect(ageFromBirthYear(1990, 2026)).toBe(36);
  });
});

// AC-3 (005): plausibility bounds, same schema client + server.
describe("makeUpsertProfileSchema", () => {
  const schema = makeUpsertProfileSchema(2026);
  const valid = {
    birthYear: 1990,
    sex: "male",
    heightCm: 180,
    weightKg: 80,
    activityLevel: "moderate",
  };

  it("accepts a plausible profile", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("rejects a birth year in the future", () => {
    expect(schema.safeParse({ ...valid, birthYear: 2030 }).success).toBe(false);
  });

  it("rejects an out-of-range height", () => {
    expect(schema.safeParse({ ...valid, heightCm: 0 }).success).toBe(false);
  });

  it("rejects an unknown activity level", () => {
    expect(schema.safeParse({ ...valid, activityLevel: "athlete" }).success).toBe(false);
  });
});
