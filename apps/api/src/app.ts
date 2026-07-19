import { HealthResponseSchema } from "@ontrack/shared";
import Fastify from "fastify";

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
  });

  app.get("/api/v1/health", async () =>
    HealthResponseSchema.parse({
      status: "ok",
      version: process.env.APP_VERSION ?? "dev",
    }),
  );

  return app;
}
