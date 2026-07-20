import { describe, expect, it } from "vitest";
import {
  AnalyzePhotoRequestSchema,
  CreateMealEntrySchema,
  CreatePhotoMealSchema,
  intakeByHour,
  kcalPerGram,
  PhotoFoodItemSchema,
  servingKcal,
} from "./meal.js";

const IMG = "data:image/webp;base64,AAAA";

describe("meal helpers", () => {
  // AC-1
  it("computes kcal from servings, rounded", () => {
    expect(servingKcal(247, 1)).toBe(247);
    expect(servingKcal(90.4, 2.5)).toBe(226);
  });

  it("buckets and sums intake by local hour", () => {
    const at = (h: number) => new Date(2026, 6, 20, h, 15).toISOString();
    const byHour = intakeByHour([
      { kcal: 300, loggedAt: at(8) },
      { kcal: 150, loggedAt: at(8) },
      { kcal: 600, loggedAt: at(13) },
    ]);
    expect(byHour[8]).toBe(450);
    expect(byHour[13]).toBe(600);
    expect(byHour[9]).toBeUndefined();
  });

  it("accepts a valid create payload and rejects bad ones", () => {
    const base = { name: "Oats", kcal: 350, source: "manual", loggedAt: new Date().toISOString() };
    expect(CreateMealEntrySchema.safeParse(base).success).toBe(true);
    expect(CreateMealEntrySchema.safeParse({ ...base, kcal: -1 }).success).toBe(false);
    expect(CreateMealEntrySchema.safeParse({ ...base, source: "wat" }).success).toBe(false);
    expect(CreateMealEntrySchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });

  // AC-1 (008): 'photo' is a valid meal source alongside manual/search.
  it("accepts 'photo' as a meal source", () => {
    const base = { name: "Salad", kcal: 200, source: "photo", loggedAt: new Date().toISOString() };
    expect(CreateMealEntrySchema.safeParse(base).success).toBe(true);
  });
});

describe("photo (008) schemas", () => {
  it("validates the analyze request image data URL", () => {
    expect(AnalyzePhotoRequestSchema.safeParse({ image: IMG }).success).toBe(true);
    expect(AnalyzePhotoRequestSchema.safeParse({ image: "not-an-image" }).success).toBe(false);
    expect(AnalyzePhotoRequestSchema.safeParse({ image: "" }).success).toBe(false);
  });

  it("validates a proposed food item", () => {
    expect(PhotoFoodItemSchema.safeParse({ name: "Rice", kcal: 210 }).success).toBe(true);
    expect(
      PhotoFoodItemSchema.safeParse({ name: "Rice", kcal: 210, grams: 150, portion: "1 cup" })
        .success,
    ).toBe(true);
    expect(PhotoFoodItemSchema.safeParse({ name: "", kcal: 210 }).success).toBe(false);
    expect(PhotoFoodItemSchema.safeParse({ name: "Rice", kcal: -5 }).success).toBe(false);
    expect(PhotoFoodItemSchema.safeParse({ name: "Rice", kcal: 210, grams: 0 }).success).toBe(
      false,
    );
  });

  it("derives kcal per gram, or null without a usable weight", () => {
    expect(kcalPerGram({ kcal: 330, grams: 165 })).toBe(2);
    expect(kcalPerGram({ kcal: 210 })).toBeNull();
    expect(kcalPerGram({ kcal: 210, grams: 0 })).toBeNull();
  });

  it("requires a thumbnail and at least one item to save a photo meal", () => {
    const base = {
      thumbnail: IMG,
      loggedAt: "2026-07-20T08:15:00.000Z",
      items: [{ name: "Eggs", kcal: 155 }],
    };
    expect(CreatePhotoMealSchema.safeParse(base).success).toBe(true);
    expect(CreatePhotoMealSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(CreatePhotoMealSchema.safeParse({ ...base, thumbnail: "nope" }).success).toBe(false);
  });
});
