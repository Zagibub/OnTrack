import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { magicLink } from "better-auth/plugins";
import type { Db } from "../db/index.js";
import { emailLog } from "../db/schema.js";
import type { Env } from "../env.js";
import type { Mailer } from "../mailer.js";
import { checkMagicLinkRateLimit, normalizeEmail } from "./rate-limit.js";

const DAY_S = 24 * 60 * 60;

export function createAuth(db: Db, mailer: Mailer, env: Env) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    baseURL: env.appUrl,
    basePath: "/api/auth",
    secret: env.authSecret,
    trustedOrigins: [env.appUrl],
    session: {
      expiresIn: 30 * DAY_S,
      updateAge: DAY_S,
    },
    plugins: [
      magicLink({
        expiresIn: 15 * 60,
        sendMagicLink: async ({ email, url }) => {
          const recipient = normalizeEmail(email);
          const verdict = await checkMagicLinkRateLimit(db, recipient);
          if (!verdict.allowed) {
            throw new APIError("TOO_MANY_REQUESTS", {
              message:
                verdict.reason === "cooldown"
                  ? "A link was just sent. Check your inbox or try again in a minute."
                  : "Too many sign-in emails today. Try again tomorrow.",
            });
          }
          try {
            const { providerId } = await mailer.sendMagicLink({ to: recipient, url });
            await db
              .insert(emailLog)
              .values({ recipient, type: "magic-link", providerId, status: "sent" });
          } catch {
            await db
              .insert(emailLog)
              .values({ recipient, type: "magic-link", providerId: null, status: "failed" });
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Couldn't send the email. Try again.",
            });
          }
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
