import { z } from "zod";

// Feature 011 — workout logging contracts + kcal estimation.

/**
 * Built-in activities and their MET (metabolic equivalent) values, roughly the 2011
 * Compendium of Physical Activities at a moderate effort. Deliberately small: custom
 * activities with user-defined METs are a later slice. `other` has no MET of its own,
 * so a moderate 5.0 stands in.
 */
export const ACTIVITY_METS = {
  walking: 3.5,
  running: 9.8,
  cycling: 7.5,
  swimming: 7.0,
  rowing: 7.0,
  elliptical: 5.0,
  strength: 5.0,
  hiit: 8.0,
  yoga: 3.0,
  other: 5.0,
} as const;

export const ACTIVITY_TYPES = Object.keys(ACTIVITY_METS) as [ActivityType, ...ActivityType[]];
export type ActivityType = keyof typeof ACTIVITY_METS;

/** Free-text activity name is stored only for this key; built-in labels are i18n. */
export const FREE_TEXT_ACTIVITY = "other" satisfies ActivityType;

export const DURATION_MIN_MINUTES = 1;
/** One day. A workout is a single instant, not a span, so longer makes no sense. */
export const DURATION_MAX_MINUTES = 1440;

/** ml O₂ per kg per minute for one MET, over the 5 kcal per litre of O₂ → the /200. */
const MET_KCAL_FACTOR = 3.5 / 200;

export interface ExerciseKcalInput {
  activity: ActivityType;
  durationMin: number;
  /** The user's *current* weight. 0 (unknown) yields no estimate. */
  weightKg: number;
}

/**
 * Estimated *net* burn: `(MET − 1) × 3.5 × kg / 200 × min`, rounded.
 *
 * The conventional formula uses the raw MET, which includes the ~1 MET the body burns
 * at rest during that time. Today's baseline already charges resting expenditure for
 * every hour of the day (`hourlyBaseline`), so a raw-MET figure would double-count it.
 * Subtracting the resting MET makes this mean "extra burn on top of the baseline" —
 * exactly what the balance adds (spec §5, SPEC §3.4).
 */
export function estimateExerciseKcal({
  activity,
  durationMin,
  weightKg,
}: ExerciseKcalInput): number {
  if (durationMin <= 0 || weightKg <= 0) return 0;
  const netMet = ACTIVITY_METS[activity] - 1;
  return Math.round(netMet * MET_KCAL_FACTOR * weightKg * durationMin);
}

/** Sum exercise kcal into local hour-of-day buckets (for the Today chart). */
export function burnByHour(
  entries: ReadonlyArray<{ kcal: number; loggedAt: string | number | Date }>,
): Record<number, number> {
  const byHour: Record<number, number> = {};
  for (const entry of entries) {
    const hour = new Date(entry.loggedAt).getHours();
    byHour[hour] = (byHour[hour] ?? 0) + entry.kcal;
  }
  return byHour;
}

const ActivityTypeSchema = z.enum(ACTIVITY_TYPES);
const ActivityNameSchema = z.string().trim().min(1).max(120).nullable();

/**
 * A stored name is required iff the activity is `other`, and forbidden otherwise —
 * the label of a built-in activity is an i18n concern, never persisted.
 */
export function activityNameIsValid(activity: ActivityType, name: string | null): boolean {
  return activity === FREE_TEXT_ACTIVITY ? name !== null && name.trim().length > 0 : name === null;
}

const NAME_RULE = {
  message: "name is required for 'other' and must be null otherwise",
  path: ["name"] as PropertyKey[],
};

/** Request body for logging a workout. */
export const CreateExerciseEntrySchema = z
  .object({
    activity: ActivityTypeSchema,
    /** Free text — only for `other`; null for every built-in activity. */
    name: ActivityNameSchema,
    durationMin: z.number().int().min(DURATION_MIN_MINUTES).max(DURATION_MAX_MINUTES),
    /** Denormalised at save time, so history never shifts if the MET tables change. */
    kcal: z.number().int().min(0).max(20000),
    /** Absolute instant the workout is logged for (ISO 8601 with offset). */
    loggedAt: z.string().datetime({ offset: true }),
  })
  .refine((e) => activityNameIsValid(e.activity, e.name), NAME_RULE);
export type CreateExerciseEntry = z.infer<typeof CreateExerciseEntrySchema>;

export const ExerciseEntrySchema = z
  .object({
    id: z.number().int(),
    activity: ActivityTypeSchema,
    name: ActivityNameSchema,
    durationMin: z.number().int().min(DURATION_MIN_MINUTES).max(DURATION_MAX_MINUTES),
    kcal: z.number().int().min(0).max(20000),
    loggedAt: z.string().datetime({ offset: true }),
  })
  .refine((e) => activityNameIsValid(e.activity, e.name), NAME_RULE);
export type ExerciseEntry = z.infer<typeof ExerciseEntrySchema>;

/**
 * Partial update of a saved workout. The `other` ⇔ `name` rule can only be judged on
 * the *merged* row, so the server applies {@link activityNameIsValid} after merging;
 * here we only check that something is actually being changed.
 */
export const UpdateExerciseEntrySchema = z
  .object({
    activity: ActivityTypeSchema,
    name: ActivityNameSchema,
    durationMin: z.number().int().min(DURATION_MIN_MINUTES).max(DURATION_MAX_MINUTES),
    kcal: z.number().int().min(0).max(20000),
    loggedAt: z.string().datetime({ offset: true }),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "at least one field is required",
  });
export type UpdateExerciseEntry = z.infer<typeof UpdateExerciseEntrySchema>;
