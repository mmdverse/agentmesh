import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import type { ControlPlaneConfig } from "@agentmesh/config";
import { createEventBus } from "@agentmesh/events";
import { healthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1/index.js";

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

  const eventBus = createEventBus({ serviceName: "control-plane", url: opts.config.NATS_URL });

  app.decorate("config", opts.config);
  app.decorate("eventBus", eventBus);

  app.addHook("onRequest", async (req) => {
    // @ts-ignore
    req.traceId = req.headers["x-trace-id"] ?? `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
