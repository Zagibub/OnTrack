import { and, count, eq, gte } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { emailLog } from "../db/schema.js";

export const RATE_LIMITS = {
  perAddressCooldownMs: 60_000,
  perAddressDailyMax: 5,
  globalDailyMax: 200,
};

export type RateLimitVerdict =
  | { allowed: true }
  | { allowed: false; reason: "cooldown" | "daily" | "global" };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Only successfully sent mails count against the limits (failures must not lock users out). */
export async function checkMagicLinkRateLimit(
  db: Db,
  email: string,
  now: Date = new Date(),
): Promise<RateLimitVerdict> {
  const recipient = normalizeEmail(email);
  const cooldownStart = new Date(now.getTime() - RATE_LIMITS.perAddressCooldownMs);
  const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [inCooldown] = await db
    .select({ n: count() })
    .from(emailLog)
    .where(
      and(
        eq(emailLog.recipient, recipient),
        eq(emailLog.status, "sent"),
        gte(emailLog.sentAt, cooldownStart),
      ),
    );
  if ((inCooldown?.n ?? 0) > 0) return { allowed: false, reason: "cooldown" };

  const [todayForAddress] = await db
    .select({ n: count() })
    .from(emailLog)
    .where(
      and(
        eq(emailLog.recipient, recipient),
        eq(emailLog.status, "sent"),
        gte(emailLog.sentAt, dayStart),
      ),
    );
  if ((todayForAddress?.n ?? 0) >= RATE_LIMITS.perAddressDailyMax) {
    return { allowed: false, reason: "daily" };
  }

  const [todayGlobal] = await db
    .select({ n: count() })
    .from(emailLog)
    .where(and(eq(emailLog.status, "sent"), gte(emailLog.sentAt, dayStart)));
  if ((todayGlobal?.n ?? 0) >= RATE_LIMITS.globalDailyMax) {
    return { allowed: false, reason: "global" };
  }

  return { allowed: true };
}
