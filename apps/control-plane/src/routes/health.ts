import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "control-plane",
      version: app.config.VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/ready", async () => {
    return {
      ready: true,
      checks: {
        database: "unknown (Phase 0 - will check Postgres in Phase 1)",
        redis: "unknown (Phase 0)",
        nats: "unknown (Phase 0)",
      },
    };
  });
}
