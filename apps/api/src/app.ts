import {
  type ActivityLevel,
  AnalyzePhotoRequestSchema,
  ageFromBirthYear,
  CreateMealEntrySchema,
  CreatePhotoMealSchema,
  calculateBmr,
  calculateTdee,
  HealthResponseSchema,
  makeUpsertProfileSchema,
  type Profile,
  type Sex,
} from "@ontrack/shared";
import { and, asc, count, desc, eq, gte, lte } from "drizzle-orm";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import type { Auth } from "./auth/auth.js";
import type { Db } from "./db/index.js";
import { mealEntries, mealPhotos, photoAnalyses, profiles, weightEntries } from "./db/schema.js";
import type { FoodSearch } from "./food-search.js";
import type { VisionProvider } from "./vision.js";

export interface AppDeps {
  auth?: Auth;
  db?: Db;
  foodSearch?: FoodSearch;
  vision?: VisionProvider;
  /** Max successful photo analyses per user per calendar day. */
  photoDailyQuota?: number;
}

// Base64 image data URLs are large; allow generous request bodies for photo analysis.
const BODY_LIMIT_BYTES = 8 * 1024 * 1024;

function toWebHeaders(req: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.append(key, Array.isArray(value) ? value.join(", ") : value.toString());
  }
  return headers;
}

async function loadProfile(db: Db, userId: string): Promise<Profile | null> {
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!row) return null;

  const [latest] = await db
    .select()
    .from(weightEntries)
    .where(eq(weightEntries.userId, userId))
    .orderBy(desc(weightEntries.date), desc(weightEntries.id))
    .limit(1);
  const weightKg = latest?.weightKg ?? 0;

  const bmrInput = {
    sex: row.sex as Sex,
    weightKg,
    heightCm: row.heightCm,
    age: ageFromBirthYear(row.birthYear, new Date().getFullYear()),
  };
  return {
    birthYear: row.birthYear,
    sex: row.sex as Sex,
    heightCm: row.heightCm,
    weightKg,
    activityLevel: row.activityLevel as ActivityLevel,
    bmr: Math.round(calculateBmr(bmrInput)),
    tdee: calculateTdee({ ...bmrInput, activityLevel: row.activityLevel as ActivityLevel }),
    photoConsent: row.photoConsentAt !== null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Start of the current UTC calendar day — the boundary for the daily photo quota. */
function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toMealEntry(row: typeof mealEntries.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    kcal: row.kcal,
    source: row.source,
    loggedAt: row.loggedAt.toISOString(),
  };
}

export function buildApp({ auth, db, foodSearch, vision, photoDailyQuota = 20 }: AppDeps = {}) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    bodyLimit: BODY_LIMIT_BYTES,
  });

  app.get("/api/v1/health", async () =>
    HealthResponseSchema.parse({
      status: "ok",
      version: process.env.APP_VERSION ?? "dev",
    }),
  );

  if (auth) {
    app.route({
      method: ["GET", "POST"],
      url: "/api/auth/*",
      handler: async (req, reply) => {
        const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
        const request = new Request(url, {
          method: req.method,
          headers: toWebHeaders(req),
          body: req.body ? JSON.stringify(req.body) : undefined,
        });

        const response = await auth.handler(request);

        reply.status(response.status);
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() !== "set-cookie") reply.header(key, value);
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length > 0) reply.header("set-cookie", cookies);
        reply.send(response.body ? await response.text() : null);
      },
    });

    const requireUser = async (req: FastifyRequest, reply: FastifyReply) => {
      const session = await auth.api.getSession({ headers: toWebHeaders(req) });
      if (!session) {
        reply.code(401).send({ message: "Unauthenticated" });
        return null;
      }
      return session.user;
    };

    app.get("/api/v1/me", async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;
      const { id, email, name } = user;
      return { user: { id, email, name } };
    });

    if (db) {
      app.get("/api/v1/profile", async (req, reply) => {
        const user = await requireUser(req, reply);
        if (!user) return;
        const profile = await loadProfile(db, user.id);
        if (!profile) return reply.code(404).send({ message: "No profile yet" });
        return profile;
      });

      app.put("/api/v1/profile", async (req, reply) => {
        const user = await requireUser(req, reply);
        if (!user) return;

        const parsed = makeUpsertProfileSchema(new Date().getFullYear()).safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({ message: "Invalid profile", issues: parsed.error.issues });
        }
        const { birthYear, sex, heightCm, activityLevel, weightKg } = parsed.data;

        await db
          .insert(profiles)
          .values({ userId: user.id, birthYear, sex, heightCm, activityLevel })
          .onConflictDoUpdate({
            target: profiles.userId,
            set: { birthYear, sex, heightCm, activityLevel, updatedAt: new Date() },
          });

        // The wizard weight seeds the first weight entry; later profile edits don't
        // add entries — weight tracking owns that (SPEC §3.5, AC-2).
        const existing = await db
          .select({ id: weightEntries.id })
          .from(weightEntries)
          .where(eq(weightEntries.userId, user.id))
          .limit(1);
        if (existing.length === 0) {
          await db.insert(weightEntries).values({
            userId: user.id,
            date: new Date().toISOString().slice(0, 10),
            weightKg,
          });
        }

        return await loadProfile(db, user.id);
      });

      app.post("/api/v1/meal-entries", async (req, reply) => {
        const user = await requireUser(req, reply);
        if (!user) return;

        const parsed = CreateMealEntrySchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({ message: "Invalid entry", issues: parsed.error.issues });
        }
        const { name, kcal, source, loggedAt } = parsed.data;
        const [row] = await db
          .insert(mealEntries)
          .values({ userId: user.id, name, kcal, source, loggedAt: new Date(loggedAt) })
          .returning();
        if (!row) return reply.code(500).send({ message: "Failed to save entry" });
        return reply.code(201).send(toMealEntry(row));
      });

      app.get("/api/v1/meal-entries", async (req, reply) => {
        const user = await requireUser(req, reply);
        if (!user) return;

        const { from, to } = (req.query ?? {}) as { from?: string; to?: string };
        const filters = [eq(mealEntries.userId, user.id)];
        if (from) filters.push(gte(mealEntries.loggedAt, new Date(from)));
        if (to) filters.push(lte(mealEntries.loggedAt, new Date(to)));

        const rows = await db
          .select()
          .from(mealEntries)
          .where(and(...filters))
          .orderBy(asc(mealEntries.loggedAt));
        return rows.map(toMealEntry);
      });

      // Accept the photo content disclaimer (SPEC §3.6) — one-time, per user.
      app.post("/api/v1/photo/consent", async (req, reply) => {
        const user = await requireUser(req, reply);
        if (!user) return;
        await db
          .update(profiles)
          .set({ photoConsentAt: new Date(), updatedAt: new Date() })
          .where(eq(profiles.userId, user.id));
        return reply.code(204).send();
      });

      // Save a confirmed photo meal: one shared thumbnail + one entry per item.
      app.post("/api/v1/meal-entries/photo", async (req, reply) => {
        const user = await requireUser(req, reply);
        if (!user) return;

        const parsed = CreatePhotoMealSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply
            .code(400)
            .send({ message: "Invalid photo meal", issues: parsed.error.issues });
        }
        const { thumbnail, loggedAt, items } = parsed.data;
        const at = new Date(loggedAt);

        const entries = await db.transaction(async (tx) => {
          const [photo] = await tx
            .insert(mealPhotos)
            .values({ userId: user.id, thumbnail })
            .returning({ id: mealPhotos.id });
          if (!photo) throw new Error("Failed to store meal photo");
          return tx
            .insert(mealEntries)
            .values(
              items.map((item) => ({
                userId: user.id,
                name: item.name,
                kcal: item.kcal,
                source: "photo",
                loggedAt: at,
                photoId: photo.id,
              })),
            )
            .returning();
        });

        return reply.code(201).send({ entries: entries.map(toMealEntry) });
      });
    }

    if (foodSearch) {
      app.get("/api/v1/foods/search", async (req, reply) => {
        const user = await requireUser(req, reply);
        if (!user) return;

        const q = ((req.query ?? {}) as { q?: string }).q?.trim() ?? "";
        if (q.length < 2) return [];
        try {
          return await foodSearch.search(q);
        } catch {
          return reply.code(502).send({ message: "Food search is unavailable right now" });
        }
      });
    }

    if (db && vision) {
      // Analyse a meal photo → proposed items (a proposal only; never auto-saved).
      app.post("/api/v1/photo/analyze", async (req, reply) => {
        const user = await requireUser(req, reply);
        if (!user) return;

        const parsed = AnalyzePhotoRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({ message: "Invalid image", issues: parsed.error.issues });
        }

        // Gate on the content disclaimer before spending any vision budget.
        const [profile] = await db
          .select({ photoConsentAt: profiles.photoConsentAt })
          .from(profiles)
          .where(eq(profiles.userId, user.id))
          .limit(1);
        if (!profile?.photoConsentAt) {
          return reply.code(403).send({ message: "Photo disclaimer not accepted" });
        }

        // Enforce the per-user daily quota (cost control, SPEC §3.6).
        const [usage] = await db
          .select({ used: count() })
          .from(photoAnalyses)
          .where(
            and(eq(photoAnalyses.userId, user.id), gte(photoAnalyses.createdAt, startOfUtcDay())),
          );
        if ((usage?.used ?? 0) >= photoDailyQuota) {
          return reply.code(429).send({ message: "Daily photo analysis limit reached" });
        }

        let result: { items: unknown[] };
        try {
          result = await vision.analyze(parsed.data.image);
        } catch {
          return reply.code(502).send({ message: "Photo analysis is unavailable right now" });
        }

        await db.insert(photoAnalyses).values({ userId: user.id });
        return { items: result.items };
      });
    }
  }

  return app;
}
