import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createAuth } from "./auth/auth.js";
import { createDb, type Db, migrateDb } from "./db/index.js";
import { emailLog, profiles, weightEntries } from "./db/schema.js";
import type { Env } from "./env.js";
import type { MagicLinkEmail, Mailer } from "./mailer.js";

class FakeMailer implements Mailer {
  sent: MagicLinkEmail[] = [];
  async sendMagicLink(email: MagicLinkEmail): Promise<{ providerId: string | null }> {
    this.sent.push(email);
    return { providerId: `fake-${this.sent.length}` };
  }
}

const TEST_ENV: Env = {
  nodeEnv: "test",
  port: 0,
  databaseUrl: "set-below",
  authSecret: "test-secret-test-secret-test-secret",
  appUrl: "http://localhost:3000",
  resendApiKey: null,
  emailFrom: "test@example.com",
  migrationsDir: "./drizzle",
};

let container: StartedPostgreSqlContainer;
let db: Db;
let mailer: FakeMailer;
let app: ReturnType<typeof buildApp>;

const VALID = {
  birthYear: 1990,
  sex: "male",
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate",
};

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  db = createDb(container.getConnectionUri());
  await migrateDb(db, "./drizzle");
  mailer = new FakeMailer();
  app = buildApp({ auth: createAuth(db, mailer, TEST_ENV), db });
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

beforeEach(async () => {
  mailer.sent = [];
  await db.delete(weightEntries);
  await db.delete(profiles);
  await db.delete(emailLog);
});

async function signIn(email: string): Promise<string> {
  await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/magic-link",
    payload: { email, callbackURL: "/today" },
  });
  const url = mailer.sent[mailer.sent.length - 1]?.url;
  if (!url) throw new Error("no magic link captured");
  const verify = await app.inject({ method: "GET", url });
  const cookie = verify.headers["set-cookie"];
  const cookies = Array.isArray(cookie) ? cookie : [cookie ?? ""];
  const session = cookies.find((c) => c.includes("session_token"));
  if (!session) throw new Error("no session cookie set");
  return session.split(";")[0] ?? "";
}

const get = (cookie?: string) =>
  app.inject({ method: "GET", url: "/api/v1/profile", ...(cookie ? { headers: { cookie } } : {}) });
const put = (payload: unknown, cookie?: string) =>
  app.inject({
    method: "PUT",
    url: "/api/v1/profile",
    payload: payload as object,
    ...(cookie ? { headers: { cookie } } : {}),
  });

describe("profile API", () => {
  // AC-4 (005)
  it("returns 404 before a profile exists, then the profile after PUT", async () => {
    const cookie = await signIn("a@example.com");

    expect((await get(cookie)).statusCode).toBe(404);

    const created = await put(VALID, cookie);
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ birthYear: 1990, sex: "male", weightKg: 80 });

    const fetched = await get(cookie);
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().tdee).toBe(created.json().tdee);
    // 006: createdAt is surfaced so the Today chart can anchor day-one to it.
    expect(typeof fetched.json().createdAt).toBe("string");
    expect(Number.isNaN(Date.parse(fetched.json().createdAt))).toBe(false);
  });

  // AC-2 (005)
  it("creates a first weight entry once; a second PUT updates without adding one", async () => {
    const cookie = await signIn("b@example.com");
    const { id: userId } = (
      await app
        .inject({
          method: "GET",
          url: "/api/v1/me",
          headers: { cookie },
        })
        .then((r) => r.json())
    ).user;

    await put(VALID, cookie);
    let entries = await db.select().from(weightEntries).where(eq(weightEntries.userId, userId));
    expect(entries).toHaveLength(1);

    const updated = await put({ ...VALID, activityLevel: "sedentary" }, cookie);
    expect(updated.statusCode).toBe(200);
    expect(updated.json().activityLevel).toBe("sedentary");

    entries = await db.select().from(weightEntries).where(eq(weightEntries.userId, userId));
    expect(entries).toHaveLength(1);
  });

  // AC-3 (005)
  it("rejects an invalid payload with 400", async () => {
    const cookie = await signIn("c@example.com");

    expect((await put({ ...VALID, birthYear: 3000 }, cookie)).statusCode).toBe(400);
    expect((await put({ ...VALID, heightCm: 0 }, cookie)).statusCode).toBe(400);
  });

  // AC-5 (005): isolation
  it("keeps profiles isolated per user", async () => {
    const cookieA = await signIn("owner@example.com");
    await put(VALID, cookieA);

    const cookieB = await signIn("intruder@example.com");
    expect((await get(cookieB)).statusCode).toBe(404);

    await put({ ...VALID, birthYear: 2000, activityLevel: "extra" }, cookieB);
    // A's profile is untouched by B's write.
    expect((await get(cookieA)).json()).toMatchObject({
      birthYear: 1990,
      activityLevel: "moderate",
    });
  });

  // AC-5 (005): auth required
  it("returns 401 without a session", async () => {
    expect((await get()).statusCode).toBe(401);
    expect((await put(VALID)).statusCode).toBe(401);
  });
});
