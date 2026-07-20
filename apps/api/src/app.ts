import {
  type ActivityLevel,
  ageFromBirthYear,
  calculateBmr,
  calculateTdee,
  HealthResponseSchema,
  makeUpsertProfileSchema,
  type Profile,
  type Sex,
} from "@ontrack/shared";
import { desc, eq } from "drizzle-orm";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import type { Auth } from "./auth/auth.js";
import type { Db } from "./db/index.js";
import { profiles, weightEntries } from "./db/schema.js";

export interface AppDeps {
  auth?: Auth;
  db?: Db;
}

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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function buildApp({ auth, db }: AppDeps = {}) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
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
    }
  }

  return app;
}
