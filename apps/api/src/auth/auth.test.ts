import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createDb, type Db, migrateDb } from "../db/index.js";
import { emailLog } from "../db/schema.js";
import type { Env } from "../env.js";
import type { MagicLinkEmail, Mailer } from "../mailer.js";
import { createAuth } from "./auth.js";

class FakeMailer implements Mailer {
  sent: MagicLinkEmail[] = [];
  failNext = false;

  async sendMagicLink(email: MagicLinkEmail): Promise<{ providerId: string | null }> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("provider down");
    }
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

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  db = createDb(container.getConnectionUri());
  await migrateDb(db, "./drizzle");
  mailer = new FakeMailer();
  app = buildApp({ auth: createAuth(db, mailer, TEST_ENV) });
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

beforeEach(async () => {
  mailer.sent = [];
  mailer.failNext = false;
  await db.delete(emailLog);
});

async function requestLink(email: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/sign-in/magic-link",
    payload: { email, callbackURL: "/done" },
  });
}

function sentUrl(index = 0): string {
  const url = mailer.sent[index]?.url;
  if (!url) throw new Error("no magic link captured");
  return url;
}

async function signIn(email: string): Promise<string> {
  await requestLink(email);
  const verify = await app.inject({ method: "GET", url: sentUrl(mailer.sent.length - 1) });
  const cookie = verify.headers["set-cookie"];
  const cookies = Array.isArray(cookie) ? cookie : [cookie ?? ""];
  const session = cookies.find((c) => c.includes("session_token"));
  if (!session) throw new Error("no session cookie set");
  return session.split(";")[0] ?? "";
}

describe("magic link sign-in", () => {
  // AC-1 (004)
  it("hands the mail to the mailer and logs it", async () => {
    const res = await requestLink("New.User@Example.com");

    expect(res.statusCode).toBe(200);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe("new.user@example.com");
    expect(sentUrl()).toContain("/api/auth/magic-link/verify");

    const rows = await db.select().from(emailLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recipient: "new.user@example.com",
      type: "magic-link",
      status: "sent",
      providerId: "fake-1",
    });
  });

  // AC-2 (004)
  it("rejects a second request within the cooldown", async () => {
    await requestLink("cooldown@example.com");
    const second = await requestLink("cooldown@example.com");

    expect(second.statusCode).toBe(429);
    expect(mailer.sent).toHaveLength(1);
  });

  // AC-3 (004)
  it("rejects the 6th send of a day", async () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60_000);
    await db.insert(emailLog).values(
      Array.from({ length: 5 }, () => ({
        recipient: "heavy@example.com",
        type: "magic-link",
        status: "sent",
        sentAt: twoMinutesAgo,
      })),
    );

    const res = await requestLink("heavy@example.com");

    expect(res.statusCode).toBe(429);
    expect(mailer.sent).toHaveLength(0);
  });

  // AC-4 (004)
  it("verifying the link sets a session and /me returns the user", async () => {
    const cookie = await signIn("happy@example.com");

    const me = await app.inject({ method: "GET", url: "/api/v1/me", headers: { cookie } });

    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe("happy@example.com");
  });

  // AC-4 (004)
  it("rejects an invalid token without creating a session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/magic-link/verify?token=not-a-real-token&callbackURL=/done",
    });

    const cookies = res.headers["set-cookie"] ?? "";
    expect(String(cookies)).not.toContain("session_token=");
  });

  // AC-9 (004): tokens are single-use
  it("rejects a reused token", async () => {
    await requestLink("reuse@example.com");
    const url = sentUrl();
    await app.inject({ method: "GET", url });

    const second = await app.inject({ method: "GET", url });

    const cookies = second.headers["set-cookie"] ?? "";
    expect(String(cookies)).not.toContain("session_token=");
  });

  // AC-5 (004)
  it("returns 401 on /me without a session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/me" });

    expect(res.statusCode).toBe(401);
  });

  it("sign-out invalidates the session", async () => {
    const cookie = await signIn("bye@example.com");
    const out = await app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { cookie },
      payload: {},
    });
    expect(out.statusCode).toBe(200);

    const me = await app.inject({ method: "GET", url: "/api/v1/me", headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });

  // Edge case: failures don't count against the limits
  it("logs failed sends and lets the user retry immediately", async () => {
    mailer.failNext = true;
    const failed = await requestLink("flaky@example.com");
    expect(failed.statusCode).toBeGreaterThanOrEqual(500);

    const rows = await db.select().from(emailLog);
    expect(rows[0]?.status).toBe("failed");

    const retry = await requestLink("flaky@example.com");
    expect(retry.statusCode).toBe(200);
    expect(mailer.sent).toHaveLength(1);
  });
});
