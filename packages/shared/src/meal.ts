import { z } from "zod";

// Feature 007 — meal logging contracts + helpers.

export const MEAL_SOURCES = ["manual", "search", "photo"] as const;
export type MealSource = (typeof MEAL_SOURCES)[number];

/** Request body for logging a meal (manual entry or a chosen search result). */
export const CreateMealEntrySchema = z.object({
  name: z.string().trim().min(1).max(120),
  kcal: z.number().int().min(0).max(20000),
  source: z.enum(MEAL_SOURCES),
  /** Absolute instant the meal is logged for (ISO 8601 with offset). */
  loggedAt: z.string().datetime({ offset: true }),
});
export type CreateMealEntry = z.infer<typeof CreateMealEntrySchema>;

export const MealEntrySchema = CreateMealEntrySchema.extend({ id: z.number().int() });
export type MealEntry = z.infer<typeof MealEntrySchema>;

/** A food from the search provider, normalised to per-serving energy. */
export const FoodSearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  kcalPerServing: z.number(),
  servingLabel: z.string(),
});
export type FoodSearchResult = z.infer<typeof FoodSearchResultSchema>;

// Feature 008 — photo (vision) meal logging contracts.

/** A meal-photo data URL (compressed WebP/JPEG). Bounded so a base64 blob can't
 * blow past the API body limit — ~5 MB of base64 is ~6.9 MB of characters. */
const IMAGE_DATA_URL_MAX = 7_000_000;
const ImageDataUrlSchema = z
  .string()
  .min(1)
  .max(IMAGE_DATA_URL_MAX)
  .regex(/^data:image\/(png|jpe?g|webp);base64,/, "must be a base64 image data URL");

/** Request body for a vision analysis: the (downscaled) photo to analyse. */
export const AnalyzePhotoRequestSchema = z.object({
  image: ImageDataUrlSchema,
});
export type AnalyzePhotoRequest = z.infer<typeof AnalyzePhotoRequestSchema>;

/** One food the vision model proposed (or the user edited) — always confirmed before save. */
export const PhotoFoodItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kcal: z.number().int().min(0).max(20000),
  /** Estimated portion weight in grams; lets the UI offer a grams-based unit. */
  grams: z.number().int().positive().max(100000).optional(),
  /** Free-text portion estimate, e.g. "1 bowl (~250 g)". */
  portion: z.string().trim().max(120).optional(),
});
export type PhotoFoodItem = z.infer<typeof PhotoFoodItemSchema>;

/** kcal per gram for an item, or null when the model gave no usable weight. */
export function kcalPerGram(item: Pick<PhotoFoodItem, "kcal" | "grams">): number | null {
  return item.grams && item.grams > 0 ? item.kcal / item.grams : null;
}

/** The proposal returned from analysis — the user edits this list, never auto-saved. */
export const AnalyzePhotoResponseSchema = z.object({
  items: z.array(PhotoFoodItemSchema),
});
export type AnalyzePhotoResponse = z.infer<typeof AnalyzePhotoResponseSchema>;

/** Request body for saving a confirmed photo meal: a retained thumbnail + N items. */
export const CreatePhotoMealSchema = z.object({
  /** Small retained thumbnail (the analysis-grade original is discarded client-side). */
  thumbnail: ImageDataUrlSchema,
  loggedAt: z.string().datetime({ offset: true }),
  items: z.array(PhotoFoodItemSchema).min(1).max(20),
});
export type CreatePhotoMeal = z.infer<typeof CreatePhotoMealSchema>;

/** Response for a saved photo meal: the created entries (one per confirmed item). */
export const CreatePhotoMealResponseSchema = z.object({
  entries: z.array(MealEntrySchema),
});
export type CreatePhotoMealResponse = z.infer<typeof CreatePhotoMealResponseSchema>;

/** kcal for a number of servings, rounded to whole kcal. */
export function servingKcal(kcalPerServing: number, servings: number): number {
  return Math.round(kcalPerServing * servings);
}

/** Sum entry kcal into local hour-of-day buckets (for the Today chart). */
export function intakeByHour(
  entries: ReadonlyArray<{ kcal: number; loggedAt: string | number | Date }>,
): Record<number, number> {
  const byHour: Record<number, number> = {};
  for (const entry of entries) {
    const hour = new Date(entry.loggedAt).getHours();
    byHour[hour] = (byHour[hour] ?? 0) + entry.kcal;
  }
  return byHour;
}
