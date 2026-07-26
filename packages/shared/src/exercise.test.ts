import { describe, expect, it } from "vitest";
import {
  ACTIVITY_METS,
  ACTIVITY_TYPES,
  burnByHour,
  CreateExerciseEntrySchema,
  estimateExerciseKcal,
  UpdateExerciseEntrySchema,
} from "./exercise.js";

// Feature 011 — workout logging. The MET figure is *net*: the resting ~1 MET is
// subtracted because Today's baseline already charges it for every hour (spec §5).

describe("estimateExerciseKcal", () => {
  // AC-1: kcal = round((MET − 1) × 3.5 × kg / 200 × min).
  it("uses the net MET, the user's weight and the duration", () => {
    // running MET 9.8 → (8.8 × 3.5 × 80 / 200) = 12.32 kcal/min × 45 = 554.4
    expect(estimateExerciseKcal({ activity: "running", durationMin: 45, weightKg: 80 })).toBe(554);
  });

  it("scales linearly with duration and weight", () => {
    const base = estimateExerciseKcal({ activity: "cycling", durationMin: 30, weightKg: 80 });
    expect(estimateExerciseKcal({ activity: "cycling", durationMin: 60, weightKg: 80 })).toBe(
      base * 2,
    );
    expect(estimateExerciseKcal({ activity: "cycling", durationMin: 30, weightKg: 160 })).toBe(
      base * 2,
    );
  });

  // AC-1: a zero duration burns nothing…
  it("returns 0 for a zero or negative duration", () => {
    expect(estimateExerciseKcal({ activity: "running", durationMin: 0, weightKg: 80 })).toBe(0);
    expect(estimateExerciseKcal({ activity: "running", durationMin: -10, weightKg: 80 })).toBe(0);
  });

  // AC-1: …and with no weight on file there is nothing to estimate from (edge case §7).
  it("returns 0 when no weight is known", () => {
    expect(estimateExerciseKcal({ activity: "running", durationMin: 45, weightKg: 0 })).toBe(0);
  });

  // AC-1: "other" has no MET of its own — a moderate 5.0 stands in.
  it("falls back to a moderate MET for 'other'", () => {
    expect(ACTIVITY_METS.other).toBe(5);
    // (5 − 1) × 3.5 × 80 / 200 = 5.6 kcal/min × 30 = 168
    expect(estimateExerciseKcal({ activity: "other", durationMin: 30, weightKg: 80 })).toBe(168);
  });

  it("has a MET for every built-in activity, all above resting", () => {
    for (const activity of ACTIVITY_TYPES) {
      expect(ACTIVITY_METS[activity]).toBeGreaterThan(1);
    }
  });
});

describe("burnByHour", () => {
  const at = (h: number, kcal: number) => ({
    kcal,
    loggedAt: new Date(2026, 6, 26, h, 30).toISOString(),
  });

  // AC-2: entries land in their local hour-of-day bucket.
  it("buckets entries by local hour of day", () => {
    expect(burnByHour([at(7, 300), at(18, 200)])).toEqual({ 7: 300, 18: 200 });
  });

  // AC-2: two workouts in one hour sum rather than overwrite.
  it("sums multiple workouts in the same hour", () => {
    expect(burnByHour([at(7, 300), at(7, 120)])).toEqual({ 7: 420 });
  });

  it("returns an empty map for no entries", () => {
    expect(burnByHour([])).toEqual({});
  });
});

describe("exercise entry schemas", () => {
  const VALID = {
    activity: "running" as const,
    name: null,
    durationMin: 45,
    kcal: 554,
    loggedAt: "2026-07-26T07:30:00.000Z",
  };

  it("accepts a built-in activity with a null name", () => {
    expect(CreateExerciseEntrySchema.safeParse(VALID).success).toBe(true);
  });

  it("accepts 'other' with a free-text name", () => {
    const parsed = CreateExerciseEntrySchema.safeParse({
      ...VALID,
      activity: "other",
      name: "Bouldering",
    });
    expect(parsed.success).toBe(true);
  });

  // AC-6: the `other` ⇔ `name` rule cuts both ways — a built-in activity's label is an
  // i18n concern, never stored.
  it("rejects 'other' without a name and a built-in activity with one", () => {
    expect(CreateExerciseEntrySchema.safeParse({ ...VALID, activity: "other" }).success).toBe(
      false,
    );
    expect(
      CreateExerciseEntrySchema.safeParse({ ...VALID, activity: "other", name: "  " }).success,
    ).toBe(false);
    expect(CreateExerciseEntrySchema.safeParse({ ...VALID, name: "Jog" }).success).toBe(false);
  });

  it("rejects out-of-range durations, unknown activities and negative kcal", () => {
    expect(CreateExerciseEntrySchema.safeParse({ ...VALID, durationMin: 0 }).success).toBe(false);
    expect(CreateExerciseEntrySchema.safeParse({ ...VALID, durationMin: 1441 }).success).toBe(
      false,
    );
    expect(CreateExerciseEntrySchema.safeParse({ ...VALID, activity: "wat" }).success).toBe(false);
    expect(CreateExerciseEntrySchema.safeParse({ ...VALID, kcal: -1 }).success).toBe(false);
    expect(CreateExerciseEntrySchema.safeParse({ ...VALID, loggedAt: "nope" }).success).toBe(false);
  });

  it("requires at least one key in an update", () => {
    expect(UpdateExerciseEntrySchema.safeParse({}).success).toBe(false);
    expect(UpdateExerciseEntrySchema.safeParse({ durationMin: 20 }).success).toBe(true);
  });
});
