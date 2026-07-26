import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createAuth } from "./auth/auth.js";
import { createDb, type Db, migrateDb } from "./db/index.js";
import { emailLog, exerciseEntries } from "./db/schema.js";
import type { Env } from "./env.js";
import type { MagicLinkEmail, Mailer } from "./mailer.js";

// Feature 011 — the exercise-entries API. Owner-scoped throughout: an unknown id and
// another user's id are indistinguishable (404, never 403 — no ownership leak).

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
  openRouterApiKey: null,
  openRouterVisionModel: "test-model",
  photoDailyQuota: 20,
};

let container: StartedPostgreSqlContainer;
let db: Db;
let mailer: FakeMailer;
let app: ReturnType<typeof buildApp>;

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
  await db.delete(exerciseEntries);
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

const VALID = {
  activity: "running",
  name: null,
  durationMin: 45,
  kcal: 554,
  loggedAt: "2026-07-26T07:30:00.000Z",
};

const post = (payload: unknown, cookie?: string) =>
  app.inject({
    method: "POST",
    url: "/api/v1/exercise-entries",
    payload: payload as object,
    ...(cookie ? { headers: { cookie } } : {}),
  });
const list = (query = "", cookie?: string) =>
  app.inject({
    method: "GET",
    url: `/api/v1/exercise-entries${query}`,
    ...(cookie ? { headers: { cookie } } : {}),
  });
const earliest = (cookie?: string) =>
  app.inject({
    method: "GET",
    url: "/api/v1/exercise-entries/earliest",
    ...(cookie ? { headers: { cookie } } : {}),
  });
const patch = (id: number | string, payload: unknown, cookie?: string) =>
  app.inject({
    method: "PATCH",
    url: `/api/v1/exercise-entries/${id}`,
    payload: payload as object,
    ...(cookie ? { headers: { cookie } } : {}),
  });
const del = (id: number | string, cookie?: string) =>
  app.inject({
    method: "DELETE",
    url: `/api/v1/exercise-entries/${id}`,
    ...(cookie ? { headers: { cookie } } : {}),
  });

const DAY = "?from=2026-07-26T00:00:00.000Z&to=2026-07-26T23:59:59.000Z";

describe("exercise entries API (011)", () => {
  // AC-5: a valid workout is stored and listed back within a covering range.
  it("creates a workout and lists it back within a range", async () => {
    const cookie = await signIn("ex-create@example.com");

    const created = await post(VALID, cookie);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      activity: "running",
      name: null,
      durationMin: 45,
      kcal: 554,
    });
    expect(typeof created.json().id).toBe("number");

    const listed = await list(DAY, cookie);
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(1);
    expect(listed.json()[0]).toMatchObject({ activity: "running", kcal: 554 });
  });

  it("stores a free-text name for the 'other' activity", async () => {
    const cookie = await signIn("ex-other@example.com");
    const created = await post(
      { ...VALID, activity: "other", name: "Bouldering", kcal: 300 },
      cookie,
    );
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ activity: "other", name: "Bouldering" });
  });

  it("excludes workouts outside the requested range", async () => {
    const cookie = await signIn("ex-range@example.com");
    await post(VALID, cookie);
    const other = await list("?from=2026-07-27T00:00:00.000Z&to=2026-07-27T23:59:59.000Z", cookie);
    expect(other.json()).toEqual([]);
  });

  // AC-6: validation.
  it("rejects invalid bodies", async () => {
    const cookie = await signIn("ex-bad@example.com");
    expect((await post({ ...VALID, durationMin: 0 }, cookie)).statusCode).toBe(400);
    expect((await post({ ...VALID, durationMin: 1441 }, cookie)).statusCode).toBe(400);
    expect((await post({ ...VALID, activity: "moonwalking" }, cookie)).statusCode).toBe(400);
    // "other" needs a name…
    expect((await post({ ...VALID, activity: "other" }, cookie)).statusCode).toBe(400);
    // …and a built-in activity must not carry one.
    expect((await post({ ...VALID, name: "Jog" }, cookie)).statusCode).toBe(400);
    expect((await post({ ...VALID, kcal: -1 }, cookie)).statusCode).toBe(400);
    expect((await post({ ...VALID, loggedAt: "nope" }, cookie)).statusCode).toBe(400);
  });

  it("requires authentication on every route", async () => {
    expect((await post(VALID)).statusCode).toBe(401);
    expect((await list()).statusCode).toBe(401);
    expect((await earliest()).statusCode).toBe(401);
    expect((await patch(1, { kcal: 1 })).statusCode).toBe(401);
    expect((await del(1)).statusCode).toBe(401);
  });

  // AC-7: isolation — B can neither see nor touch A's workout.
  it("never leaks or mutates another user's workout", async () => {
    const a = await signIn("ex-owner@example.com");
    const id = (await post(VALID, a)).json().id;
    const b = await signIn("ex-intruder@example.com");

    expect((await list(DAY, b)).json()).toEqual([]);
    expect((await patch(id, { kcal: 1 }, b)).statusCode).toBe(404);
    expect((await del(id, b)).statusCode).toBe(404);

    // A's row is untouched.
    expect((await list(DAY, a)).json()[0]).toMatchObject({ kcal: 554 });
  });

  it("returns 404 for an unknown or non-numeric id", async () => {
    const cookie = await signIn("ex-missing@example.com");
    expect((await patch(999999, { kcal: 1 }, cookie)).statusCode).toBe(404);
    expect((await del(999999, cookie)).statusCode).toBe(404);
    expect((await del("abc", cookie)).statusCode).toBe(404);
  });

  // The PATCH ships now so the follow-up edit UI is trivial (spec §2).
  it("updates a workout's fields", async () => {
    const cookie = await signIn("ex-edit@example.com");
    const id = (await post(VALID, cookie)).json().id;

    const res = await patch(id, { durationMin: 30, kcal: 370 }, cookie);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, activity: "running", durationMin: 30, kcal: 370 });
  });

  it("moves a workout to another day when loggedAt changes", async () => {
    const cookie = await signIn("ex-redate@example.com");
    const id = (await post(VALID, cookie)).json().id;

    expect((await patch(id, { loggedAt: "2026-07-25T07:30:00.000Z" }, cookie)).statusCode).toBe(
      200,
    );
    expect((await list(DAY, cookie)).json()).toHaveLength(0);
    expect(
      (await list("?from=2026-07-25T00:00:00.000Z&to=2026-07-25T23:59:59.000Z", cookie)).json(),
    ).toHaveLength(1);
  });

  // AC-6 / spec §4: the other ⇔ name rule holds on the *merged* row, not just the patch.
  it("applies the other/name rule to the merged row on update", async () => {
    const cookie = await signIn("ex-merge@example.com");
    const builtIn = (await post(VALID, cookie)).json().id;

    // running + a name → invalid merged result.
    expect((await patch(builtIn, { name: "Jog" }, cookie)).statusCode).toBe(400);
    // switching to "other" without supplying a name → still nameless → invalid.
    expect((await patch(builtIn, { activity: "other" }, cookie)).statusCode).toBe(400);
    // switching to "other" *with* a name → fine.
    expect(
      (await patch(builtIn, { activity: "other", name: "Bouldering" }, cookie)).statusCode,
    ).toBe(200);

    // And back the other way: an "other" row moving to a built-in must drop its name.
    expect((await patch(builtIn, { activity: "cycling" }, cookie)).statusCode).toBe(400);
    expect((await patch(builtIn, { activity: "cycling", name: null }, cookie)).statusCode).toBe(
      200,
    );
  });

  it("rejects an empty update", async () => {
    const cookie = await signIn("ex-empty@example.com");
    const id = (await post(VALID, cookie)).json().id;
    expect((await patch(id, {}, cookie)).statusCode).toBe(400);
  });

  it("deletes a workout", async () => {
    const cookie = await signIn("ex-del@example.com");
    const id = (await post(VALID, cookie)).json().id;
    expect((await del(id, cookie)).statusCode).toBe(204);
    expect((await list(DAY, cookie)).json()).toHaveLength(0);
  });

  // AC-8: the data horizon's lower edge.
  it("reports the earliest logged workout, or null when nothing is logged", async () => {
    const cookie = await signIn("ex-earliest@example.com");
    expect((await earliest(cookie)).json()).toEqual({ loggedAt: null });

    await post(VALID, cookie); // 2026-07-26
    await post({ ...VALID, loggedAt: "2026-07-24T06:00:00.000Z" }, cookie);
    await post({ ...VALID, loggedAt: "2026-07-28T06:00:00.000Z" }, cookie);

    expect(new Date((await earliest(cookie)).json().loggedAt).toISOString()).toBe(
      "2026-07-24T06:00:00.000Z",
    );
  });

  it("scopes the earliest workout to its owner", async () => {
    const a = await signIn("ex-earliest-a@example.com");
    await post(VALID, a);
    const b = await signIn("ex-earliest-b@example.com");
    expect((await earliest(b)).json()).toEqual({ loggedAt: null });
  });
});
