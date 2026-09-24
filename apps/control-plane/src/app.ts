import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import type { ControlPlaneConfig } from "@agentmesh/config";
import { createEventBus } from "@agentmesh/events";
import { healthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1/index.js";
import { observabilityPlugin } from "./plugins/observability.js";
import { authPlugin } from "./plugins/auth.js";
import { tenantPlugin } from "./plugins/tenant.js";
import { rateLimitPlugin } from "./plugins/rate-limit.js";
import { authorizationPlugin } from "./plugins/authorization.js";

export interface BuildAppOptions {
  config: ControlPlaneConfig;
  logger?: boolean;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? { level: opts.config.CONTROL_PLANE_LOG_LEVEL },
    trustProxy: true,
  });

  await app.register(cors, { origin: true });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(sensible);

  await app.register(observabilityPlugin, { serviceName: "control-plane" });

  await app.register(authPlugin, {
    jwtSecret: opts.config.JWT_SECRET,
    oidcIssuer: opts.config.OIDC_ISSUER,
    oidcClientId: opts.config.OIDC_CLIENT_ID,
    publicRoutes: ["/health", "/ready", "/v1/health", "/v1/info", "/v1/observability/*", "/v1/reliability/*"],
  });
  await app.register(tenantPlugin);
  await app.register(rateLimitPlugin, { enabled: true });
  await app.register(authorizationPlugin, {
    publicRoutes: ["/health", "/ready", "/v1/health", "/v1/info", "/v1/observability/*", "/v1/reliability/*"],
  });

  const eventBus = createEventBus({ serviceName: "control-plane", url: opts.config.NATS_URL });

  app.decorate("config", opts.config);
  app.decorate("eventBus", eventBus);

  app.addHook("onResponse", async (req, reply) => {
    if (req.url.includes("/health")) return;
    app.log.info(
      {
        method: req.method,
        url: req.url,
        status: reply.statusCode,
        traceId: (req as any).traceId,
        tenant: (req as any).tenant,
        auth: (req as any).auth?.method,
      },
      "request completed"
    );
  });

  await app.register(healthRoutes, { prefix: "/" });
  await app.register(v1Routes, { prefix: "/v1" });

  app.setErrorHandler((error, _req, reply) => {
    const err = error as any;
    const status = err.statusCode ?? 500;
    const code = err.code ?? "INTERNAL_ERROR";
    app.log.error({ err: error, status, code }, "request error");
    reply.status(status).send({
      error: { code, message: err.message ?? "Internal Server Error", ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}) },
    });
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    config: ControlPlaneConfig;
    eventBus: ReturnType<typeof createEventBus>;
  }
  interface FastifyRequest {
    traceId: string;
  }
}
