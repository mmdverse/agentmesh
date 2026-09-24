import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import type { GatewayConfig } from "@agentmesh/config";
import { createRoutingEngine } from "@agentmesh/routing";
import { createEventBus } from "@agentmesh/events";
import { healthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1/index.js";
import { authPlugin } from "./plugins/auth.js";
import { tenantPlugin } from "./plugins/tenant.js";
import { rateLimitPlugin } from "./plugins/rate-limit.js";
import { resourceLimitsPlugin } from "./plugins/resource-limits.js";
import { circuitBreakerPlugin } from "./plugins/circuit-breaker.js";

export interface BuildAppOptions {
  config: GatewayConfig;
  logger?: boolean;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? {
      level: opts.config.GATEWAY_LOG_LEVEL,
    },
    trustProxy: true,
    bodyLimit: opts.config.MAX_MESSAGE_SIZE,
  });

  // Core plugins
  await app.register(cors, { origin: true });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(sensible);

  // Phase 3 - Security & Reliability plugins
  await app.register(authPlugin, {
    jwtSecret: opts.config.JWT_SECRET,
    publicRoutes: ["/health", "/ready", "/v1/health", "/v1/info", "/v1/reliability/stats"],
  });
  await app.register(tenantPlugin);
  await app.register(rateLimitPlugin, { enabled: true });
  await app.register(resourceLimitsPlugin, {
    limits: {
      maxMessageSize: opts.config.MAX_MESSAGE_SIZE,
      maxArtifactSize: opts.config.MAX_ARTIFACT_SIZE,
      maxFanOut: 10,
    },
  });
  await app.register(circuitBreakerPlugin, {
    failureThreshold: 5,
    timeoutMs: 60000,
    maxConcurrent: 50,
  });

  // Decorators / shared
  const routingEngine = createRoutingEngine();
  const eventBus = createEventBus({ serviceName: "gateway", url: opts.config.NATS_URL });

  app.decorate("config", opts.config);
  app.decorate("routingEngine", routingEngine);
  app.decorate("eventBus", eventBus);

  // Global hooks
  app.addHook("onRequest", async (req) => {
    // @ts-ignore
    req.traceId = req.headers["x-trace-id"] ?? `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  });

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

  // Routes
  await app.register(healthRoutes, { prefix: "/" });
  await app.register(v1Routes, { prefix: "/v1" });

  // Error handler
  app.setErrorHandler((error, _req, reply) => {
    const err = error as any;
    const status = err.statusCode ?? 500;
    const code = err.code ?? "INTERNAL_ERROR";
    app.log.error({ err: error, status, code }, "request error");
    reply.status(status).send({
      error: {
        code,
        message: err.message ?? "Internal Server Error",
        ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
      },
    });
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    config: GatewayConfig;
    routingEngine: ReturnType<typeof createRoutingEngine>;
    eventBus: ReturnType<typeof createEventBus>;
  }
  interface FastifyRequest {
    traceId: string;
  }
}
