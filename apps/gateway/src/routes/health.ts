import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "gateway",
      version: app.config.VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/ready", async () => {
    // Phase 0: always ready. Phase 1+ will check Redis/NATS/DB
    return {
      ready: true,
      checks: {
        redis: "unknown (Phase 0 - not checked)",
        nats: "unknown (Phase 0 - not checked)",
        database: "unknown (Phase 0 - not checked)",
      },
    };
  });
}
