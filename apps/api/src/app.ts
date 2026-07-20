import { HealthResponseSchema } from "@ontrack/shared";
import Fastify, { type FastifyRequest } from "fastify";
import type { Auth } from "./auth/auth.js";

export interface AppDeps {
  auth?: Auth;
}

function toWebHeaders(req: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.append(key, Array.isArray(value) ? value.join(", ") : value.toString());
  }
  return headers;
}

export function buildApp({ auth }: AppDeps = {}) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
  });

  app.get("/api/v1/health", async () =>
    HealthResponseSchema.parse({
      status: "ok",
      version: process.env.APP_VERSION ?? "dev",
    }),
  );

  if (auth) {
    app.route({
      method: ["GET", "POST"],
      url: "/api/auth/*",
      handler: async (req, reply) => {
        const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
        const request = new Request(url, {
          method: req.method,
          headers: toWebHeaders(req),
          body: req.body ? JSON.stringify(req.body) : undefined,
        });

        const response = await auth.handler(request);

        reply.status(response.status);
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() !== "set-cookie") reply.header(key, value);
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length > 0) reply.header("set-cookie", cookies);
        reply.send(response.body ? await response.text() : null);
      },
    });

    app.get("/api/v1/me", async (req, reply) => {
      const session = await auth.api.getSession({ headers: toWebHeaders(req) });
      if (!session) {
        return reply.code(401).send({ message: "Unauthenticated" });
      }
      const { id, email, name } = session.user;
      return { user: { id, email, name } };
    });
  }

  return app;
}
