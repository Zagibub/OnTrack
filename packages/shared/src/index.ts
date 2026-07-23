import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export * from "./balance.js";
export * from "./calendar.js";
export * from "./meal.js";
export * from "./profile.js";
