import type { FoodSearchResult } from "@ontrack/shared";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createAuth } from "./auth/auth.js";
import { createDb, type Db, migrateDb } from "./db/index.js";
import {
  emailLog,
  mealEntries,
  mealPhotos,
  photoAnalyses,
  profiles,
  user as userTable,
} from "./db/schema.js";
import type { Env } from "./env.js";
import type { FoodSearch } from "./food-search.js";
import type { MagicLinkEmail, Mailer } from "./mailer.js";
import type { VisionProvider } from "./vision.js";

class FakeMailer implements Mailer {
  sent: MagicLinkEmail[] = [];
  async sendMagicLink(email: MagicLinkEmail): Promise<{ providerId: string | null }> {
    this.sent.push(email);
    return { providerId: `fake-${this.sent.length}` };
  }
}

const RESULT: FoodSearchResult = {
  id: "42",
  name: "Banana",
  brand: null,
  kcalPerServing: 105,
  servingLabel: "1 medium",
};
const fakeSearch: FoodSearch = {
  async search(q) {
    if (q === "boom") throw new Error("upstream down");
    return [RESULT];
  },
};

// The image is a base64 data URL; "boom" in it triggers a simulated provider failure.
const fakeVision: VisionProvider = {
  async analyze(image) {
    if (image.includes("boom")) throw new Error("vision down");
    return {
      items: [
        { name: "Grilled chicken", kcal: 330, portion: "1 breast" },
        { name: "Rice", kcal: 210 },
      ],
    };
  },
};
const PHOTO_QUOTA = 3;
const IMAGE = "data:image/webp;base64,AAAA";
const BOOM_IMAGE = "data:image/webp;base64,boom";

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
  app = buildApp({
    auth: createAuth(db, mailer, TEST_ENV),
    db,
    foodSearch: fakeSearch,
    vision: fakeVision,
    photoDailyQuota: PHOTO_QUOTA,
  });
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

beforeEach(async () => {
  mailer.sent = [];
  await db.delete(mealEntries);
  await db.delete(mealPhotos);
  await db.delete(photoAnalyses);
  await db.delete(profiles);
  await db.delete(emailLog);
});

async function userIdFor(email: string): Promise<string> {
  const [u] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);
  if (!u) throw new Error(`no user for ${email}`);
  return u.id;
}

/** Photo endpoints need a profile row (consent lives there); seed a minimal one. */
async function seedProfile(email: string): Promise<void> {
  await db
    .insert(profiles)
    .values({
      userId: await userIdFor(email),
      birthYear: 1990,
      sex: "male",
      heightCm: 180,
      activityLevel: "moderate",
    })
    .onConflictDoNothing();
}

const analyze = (image: unknown, cookie?: string) =>
  app.inject({
    method: "POST",
    url: "/api/v1/photo/analyze",
    payload: { image } as object,
    ...(cookie ? { headers: { cookie } } : {}),
  });
const consent = (cookie: string) =>
  app.inject({ method: "POST", url: "/api/v1/photo/consent", headers: { cookie } });
const savePhoto = (payload: unknown, cookie?: string) =>
  app.inject({
    method: "POST",
    url: "/api/v1/meal-entries/photo",
    payload: payload as object,
    ...(cookie ? { headers: { cookie } } : {}),
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
  name: "Oatmeal",
  kcal: 350,
  source: "manual",
  loggedAt: "2026-07-20T08:15:00.000Z",
};

const post = (payload: unknown, cookie?: string) =>
  app.inject({
    method: "POST",
    url: "/api/v1/meal-entries",
    payload: payload as object,
    ...(cookie ? { headers: { cookie } } : {}),
  });
const list = (query = "", cookie?: string) =>
  app.inject({
    method: "GET",
    url: `/api/v1/meal-entries${query}`,
    ...(cookie ? { headers: { cookie } } : {}),
  });
const patch = (id: number | string, payload: unknown, cookie?: string) =>
  app.inject({
    method: "PATCH",
    url: `/api/v1/meal-entries/${id}`,
    payload: payload as object,
    ...(cookie ? { headers: { cookie } } : {}),
  });
const del = (id: number | string, cookie?: string) =>
  app.inject({
    method: "DELETE",
    url: `/api/v1/meal-entries/${id}`,
    ...(cookie ? { headers: { cookie } } : {}),
  });

describe("meal entries API", () => {
  // AC-2
  it("creates an entry and lists it back within a range", async () => {
    const cookie = await signIn("a@example.com");

    const created = await post(VALID, cookie);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ name: "Oatmeal", kcal: 350, source: "manual" });
    expect(typeof created.json().id).toBe("number");

    const res = await list("?from=2026-07-20T00:00:00.000Z&to=2026-07-20T23:59:59.000Z", cookie);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].kcal).toBe(350);
  });

  // AC-3
  it("rejects an invalid payload", async () => {
    const cookie = await signIn("b@example.com");
    expect((await post({ ...VALID, kcal: -1 }, cookie)).statusCode).toBe(400);
    expect((await post({ ...VALID, source: "wat" }, cookie)).statusCode).toBe(400);
  });

  it("requires authentication", async () => {
    expect((await post(VALID)).statusCode).toBe(401);
    expect((await list()).statusCode).toBe(401);
  });

  // AC-4
  it("never leaks another user's entries", async () => {
    const a = await signIn("owner@example.com");
    await post(VALID, a);
    const b = await signIn("intruder@example.com");
    expect((await list("", b)).json()).toEqual([]);
  });
});

describe("meal entries edit/delete API (009)", () => {
  const dayRange = (isoDay: string) => `?from=${isoDay}T00:00:00.000Z&to=${isoDay}T23:59:59.000Z`;

  // AC-1 (009): owner can update fields.
  it("updates an entry's fields", async () => {
    const cookie = await signIn("edit@example.com");
    const id = (await post(VALID, cookie)).json().id;

    const res = await patch(id, { name: "Porridge", kcal: 420 }, cookie);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, name: "Porridge", kcal: 420, source: "manual" });

    const listed = (await list(dayRange("2026-07-20"), cookie)).json();
    expect(listed[0]).toMatchObject({ name: "Porridge", kcal: 420 });
  });

  // AC-2 (009): re-dating moves the entry between days.
  it("moves an entry to another day when loggedAt changes", async () => {
    const cookie = await signIn("redate@example.com");
    const id = (await post(VALID, cookie)).json().id; // logged 2026-07-20

    expect((await patch(id, { loggedAt: "2026-07-19T08:15:00.000Z" }, cookie)).statusCode).toBe(
      200,
    );

    expect((await list(dayRange("2026-07-20"), cookie)).json()).toHaveLength(0);
    expect((await list(dayRange("2026-07-19"), cookie)).json()).toHaveLength(1);
  });

  // AC-4 (009): validation.
  it("rejects invalid updates", async () => {
    const cookie = await signIn("editbad@example.com");
    const id = (await post(VALID, cookie)).json().id;
    expect((await patch(id, {}, cookie)).statusCode).toBe(400);
    expect((await patch(id, { kcal: -1 }, cookie)).statusCode).toBe(400);
    expect((await patch(id, { name: "" }, cookie)).statusCode).toBe(400);
    expect((await patch(id, { loggedAt: "nope" }, cookie)).statusCode).toBe(400);
  });

  // AC-3 (009): no cross-user update; no ownership leak (404, not 403).
  it("does not let another user update an entry", async () => {
    const a = await signIn("owner2@example.com");
    const id = (await post(VALID, a)).json().id;
    const b = await signIn("intruder2@example.com");

    expect((await patch(id, { kcal: 1 }, b)).statusCode).toBe(404);
    expect((await list(dayRange("2026-07-20"), a)).json()[0].kcal).toBe(350);
  });

  // AC-5 (009): owner can delete; it disappears from the range.
  it("deletes an entry", async () => {
    const cookie = await signIn("del@example.com");
    const id = (await post(VALID, cookie)).json().id;

    expect((await del(id, cookie)).statusCode).toBe(204);
    expect((await list(dayRange("2026-07-20"), cookie)).json()).toHaveLength(0);
  });

  // AC-6 (009): no cross-user delete.
  it("does not let another user delete an entry", async () => {
    const a = await signIn("owner3@example.com");
    const id = (await post(VALID, a)).json().id;
    const b = await signIn("intruder3@example.com");

    expect((await del(id, b)).statusCode).toBe(404);
    expect((await list(dayRange("2026-07-20"), a)).json()).toHaveLength(1);
  });

  // AC-7 (009): auth required.
  it("requires authentication for edit and delete", async () => {
    const cookie = await signIn("authcheck@example.com");
    const id = (await post(VALID, cookie)).json().id;
    expect((await patch(id, { kcal: 1 })).statusCode).toBe(401);
    expect((await del(id)).statusCode).toBe(401);
  });

  it("returns 404 for an unknown id", async () => {
    const cookie = await signIn("missing@example.com");
    expect((await patch(999999, { kcal: 1 }, cookie)).statusCode).toBe(404);
    expect((await del(999999, cookie)).statusCode).toBe(404);
  });
});

describe("food search API", () => {
  // AC-5
  it("returns mapped results and 502 on upstream failure", async () => {
    const cookie = await signIn("s@example.com");

    const found = await app.inject({
      method: "GET",
      url: "/api/v1/foods/search?q=banana",
      headers: { cookie },
    });
    expect(found.statusCode).toBe(200);
    expect(found.json()).toEqual([RESULT]);

    const short = await app.inject({
      method: "GET",
      url: "/api/v1/foods/search?q=a",
      headers: { cookie },
    });
    expect(short.json()).toEqual([]);

    const boom = await app.inject({
      method: "GET",
      url: "/api/v1/foods/search?q=boom",
      headers: { cookie },
    });
    expect(boom.statusCode).toBe(502);
  });
});

describe("photo analysis API", () => {
  it("requires authentication", async () => {
    expect((await analyze(IMAGE)).statusCode).toBe(401);
    expect((await savePhoto({})).statusCode).toBe(401);
  });

  // AC-3 (008): the content disclaimer gates analysis (no vision spend before consent).
  it("rejects analysis until the disclaimer is accepted", async () => {
    const cookie = await signIn("consent@example.com");
    await seedProfile("consent@example.com");

    expect((await analyze(IMAGE, cookie)).statusCode).toBe(403);

    expect((await consent(cookie)).statusCode).toBe(204);
    expect((await analyze(IMAGE, cookie)).statusCode).toBe(200);
  });

  // AC-2 (008): analysis returns the (faked) vision provider's proposed items.
  it("returns proposed items from the vision provider", async () => {
    const cookie = await signIn("vision@example.com");
    await seedProfile("vision@example.com");
    await consent(cookie);

    const res = await analyze(IMAGE, cookie);
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([
      { name: "Grilled chicken", kcal: 330, portion: "1 breast" },
      { name: "Rice", kcal: 210 },
    ]);
  });

  it("validates the image payload", async () => {
    const cookie = await signIn("badimg@example.com");
    await seedProfile("badimg@example.com");
    await consent(cookie);
    expect((await analyze("not-an-image", cookie)).statusCode).toBe(400);
  });

  // AC-4 (008): the per-user daily quota caps analyses.
  it("enforces the daily analysis quota", async () => {
    const cookie = await signIn("quota@example.com");
    await seedProfile("quota@example.com");
    await consent(cookie);

    for (let i = 0; i < PHOTO_QUOTA; i++) {
      expect((await analyze(IMAGE, cookie)).statusCode).toBe(200);
    }
    expect((await analyze(IMAGE, cookie)).statusCode).toBe(429);
  });

  // AC-5 (008): a provider failure surfaces as a 502.
  it("returns 502 when the vision provider fails", async () => {
    const cookie = await signIn("visionboom@example.com");
    await seedProfile("visionboom@example.com");
    await consent(cookie);
    expect((await analyze(BOOM_IMAGE, cookie)).statusCode).toBe(502);
  });
});

describe("photo meal save API", () => {
  const validPhotoMeal = {
    thumbnail: IMAGE,
    loggedAt: "2026-07-20T12:30:00.000Z",
    items: [
      { name: "Grilled chicken", kcal: 330 },
      { name: "Rice", kcal: 210 },
    ],
  };

  // AC-6 (008): one entry per item, all photo-sourced, listed back for the owner only.
  it("saves one entry per confirmed item and lists them back", async () => {
    const cookie = await signIn("photosave@example.com");

    const created = await savePhoto(validPhotoMeal, cookie);
    expect(created.statusCode).toBe(201);
    expect(created.json().entries).toHaveLength(2);
    expect(created.json().entries.every((e: { source: string }) => e.source === "photo")).toBe(
      true,
    );

    const stored = await db.select().from(mealPhotos);
    expect(stored).toHaveLength(1);

    const listed = await list("?from=2026-07-20T00:00:00.000Z&to=2026-07-20T23:59:59.000Z", cookie);
    expect(listed.json()).toHaveLength(2);
  });

  it("rejects an empty item list", async () => {
    const cookie = await signIn("photobad@example.com");
    expect((await savePhoto({ ...validPhotoMeal, items: [] }, cookie)).statusCode).toBe(400);
  });

  it("never leaks another user's photo entries", async () => {
    const a = await signIn("photoowner@example.com");
    await savePhoto(validPhotoMeal, a);
    const b = await signIn("photointruder@example.com");
    expect((await list("", b)).json()).toEqual([]);
  });
});
