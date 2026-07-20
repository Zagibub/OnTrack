import { buildApp } from "./app.js";
import { createAuth } from "./auth/auth.js";
import { createDb, migrateDb } from "./db/index.js";
import { loadEnv } from "./env.js";
import { createOpenFoodFactsSearch } from "./food-search.js";
import { ConsoleMailer, ResendMailer } from "./mailer.js";
import { createOpenRouterVision } from "./vision.js";

const env = loadEnv();

const db = createDb(env.databaseUrl);
await migrateDb(db, env.migrationsDir);

const mailer = env.resendApiKey
  ? new ResendMailer(env.resendApiKey, env.emailFrom)
  : new ConsoleMailer();

const auth = createAuth(db, mailer, env);
const vision = env.openRouterApiKey
  ? createOpenRouterVision(env.openRouterApiKey, env.openRouterVisionModel)
  : undefined;
const app = buildApp({
  auth,
  db,
  foodSearch: createOpenFoodFactsSearch(),
  vision,
  photoDailyQuota: env.photoDailyQuota,
});

app.listen({ port: env.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
