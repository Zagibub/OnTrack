export interface Env {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  authSecret: string;
  /** Public origin the app is served from (magic links point here). */
  appUrl: string;
  resendApiKey: string | null;
  emailFrom: string;
  migrationsDir: string;
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const nodeEnv = env.NODE_ENV ?? "production";
  // Fallbacks exist ONLY for explicitly declared dev/test environments. An unset or
  // unknown NODE_ENV is treated as production: real secrets or refuse to boot.
  const isLocal = nodeEnv === "development" || nodeEnv === "test";

  const databaseUrl =
    env.DATABASE_URL ??
    (isLocal
      ? "postgres://ontrack:local-dev-password@localhost:5432/ontrack"
      : missing("DATABASE_URL"));
  const authSecret =
    env.AUTH_SECRET ?? (isLocal ? "dev-only-secret-not-for-production" : missing("AUTH_SECRET"));

  return {
    nodeEnv,
    port: Number(env.PORT ?? 3000),
    databaseUrl,
    authSecret,
    appUrl: env.APP_URL ?? "http://localhost:4200",
    resendApiKey: env.RESEND_API_KEY ?? null,
    emailFrom: env.EMAIL_FROM ?? "OnTrack <onboarding@resend.dev>",
    migrationsDir: env.MIGRATIONS_DIR ?? "./drizzle",
  };
}

function missing(name: string): never {
  throw new Error(`Missing required environment variable ${name}`);
}
