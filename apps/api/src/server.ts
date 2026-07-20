import { buildApp } from "./app.js";
import { createAuth } from "./auth/auth.js";
import { createDb, migrateDb } from "./db/index.js";
import { loadEnv } from "./env.js";
import { ConsoleMailer, ResendMailer } from "./mailer.js";

const env = loadEnv();

const db = createDb(env.databaseUrl);
await migrateDb(db, env.migrationsDir);

const mailer = env.resendApiKey
  ? new ResendMailer(env.resendApiKey, env.emailFrom)
  : new ConsoleMailer();

const auth = createAuth(db, mailer, env);
const app = buildApp({ auth, db });

app.listen({ port: env.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
