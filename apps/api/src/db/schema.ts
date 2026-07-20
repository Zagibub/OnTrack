import {
  boolean,
  date,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// better-auth core tables (field names must match better-auth's expected model fields)

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// OnTrack tables

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  birthYear: integer("birth_year").notNull(),
  sex: text("sex").notNull(),
  heightCm: integer("height_cm").notNull(),
  activityLevel: text("activity_level").notNull(),
  // Set when the user accepts the photo content disclaimer (SPEC §3.6); null = not yet.
  photoConsentAt: timestamp("photo_consent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const weightEntries = pgTable("weight_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  weightKg: real("weight_kg").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A retained meal photo (small compressed thumbnail); the analysis-grade original is
// discarded client-side after analysis (SPEC §3.6). One photo → many meal_entries.
export const mealPhotos = pgTable("meal_photos", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  thumbnail: text("thumbnail").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mealEntries = pgTable("meal_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kcal: integer("kcal").notNull(),
  source: text("source").notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull(),
  // Set for photo-sourced entries; the shared thumbnail lives on meal_photos.
  photoId: integer("photo_id").references(() => mealPhotos.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// One row per successful vision analysis — powers the per-user daily quota (SPEC §3.6).
export const photoAnalyses = pgTable("photo_analyses", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ProfileRow = typeof profiles.$inferSelect;
export type WeightEntryRow = typeof weightEntries.$inferSelect;
export type MealEntryRow = typeof mealEntries.$inferSelect;
export type MealPhotoRow = typeof mealPhotos.$inferSelect;
export type PhotoAnalysisRow = typeof photoAnalyses.$inferSelect;

export const emailLog = pgTable("email_log", {
  id: serial("id").primaryKey(),
  recipient: text("recipient").notNull(),
  type: text("type").notNull(),
  providerId: text("provider_id"),
  status: text("status").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export type EmailLogRow = typeof emailLog.$inferSelect;
