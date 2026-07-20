import { z } from "zod";

// --- Domain constants -------------------------------------------------------

export const SEX_VALUES = ["male", "female", "unspecified"] as const;
export type Sex = (typeof SEX_VALUES)[number];

/** Standard 5-level activity scale → TDEE multiplier (SPEC §3.4). */
export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
} as const;

export const ACTIVITY_VALUES = Object.keys(ACTIVITY_FACTORS) as [ActivityLevel, ...ActivityLevel[]];
export type ActivityLevel = keyof typeof ACTIVITY_FACTORS;

// Plausibility bounds (SPEC 005 §7), shared by client and server validation.
export const MIN_AGE = 10;
export const MAX_AGE = 120;
export const HEIGHT_MIN_CM = 100;
export const HEIGHT_MAX_CM = 250;
export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 300;

// --- BMR / TDEE (Mifflin-St Jeor) ------------------------------------------

export interface BmrInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}

/** Mifflin-St Jeor BMR. 'unspecified' returns the mean of the male and female formulas. */
export function calculateBmr({ sex, weightKg, heightCm, age }: BmrInput): number {
  if (weightKg <= 0 || heightCm <= 0 || age <= 0) {
    throw new RangeError("weight, height and age must be positive");
  }
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const male = base + 5;
  const female = base - 161;
  switch (sex) {
    case "male":
      return male;
    case "female":
      return female;
    default:
      return (male + female) / 2;
  }
}

/** TDEE = BMR × activity factor, rounded to whole kcal. */
export function calculateTdee(input: BmrInput & { activityLevel: ActivityLevel }): number {
  return Math.round(calculateBmr(input) * ACTIVITY_FACTORS[input.activityLevel]);
}

/** Age in whole years from a birth year, relative to the given reference year. */
export function ageFromBirthYear(birthYear: number, currentYear: number): number {
  return currentYear - birthYear;
}

// --- Contracts --------------------------------------------------------------

/**
 * Request body for creating/updating a profile. Birth-year bounds depend on the
 * current year, so this is a factory both API and web call with their own year —
 * guaranteeing identical validation and error messages on each side.
 */
export function makeUpsertProfileSchema(currentYear: number) {
  return z.object({
    birthYear: z
      .number()
      .int()
      .min(currentYear - MAX_AGE, "Please enter a valid birth year")
      .max(currentYear - MIN_AGE, "Please enter a valid birth year"),
    sex: z.enum(SEX_VALUES),
    heightCm: z.number().min(HEIGHT_MIN_CM).max(HEIGHT_MAX_CM),
    weightKg: z.number().min(WEIGHT_MIN_KG).max(WEIGHT_MAX_KG),
    activityLevel: z.enum(ACTIVITY_VALUES),
  });
}

export type UpsertProfile = z.infer<ReturnType<typeof makeUpsertProfileSchema>>;

/** Profile as returned by the API, including the computed baseline. */
export const ProfileSchema = z.object({
  birthYear: z.number().int(),
  sex: z.enum(SEX_VALUES),
  heightCm: z.number(),
  weightKg: z.number(),
  activityLevel: z.enum(ACTIVITY_VALUES),
  bmr: z.number(),
  tdee: z.number(),
  /** Whether the user has accepted the photo content disclaimer (SPEC §3.6, 008). */
  photoConsent: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Profile = z.infer<typeof ProfileSchema>;
