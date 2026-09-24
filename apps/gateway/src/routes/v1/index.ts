import type { FastifyInstance } from "fastify";

export async function v1Routes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "gateway",
      version: app.config.VERSION,
      dataPlane: "active",
      controlPlane: "cached-config (Phase 0)",
      routingStrategies: app.routingEngine.listStrategies(),
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/routes", async () => {
    return {
      routes: [],
      message: "Routing table - full implementation in Phase 2",
    };
  });

  app.get("/info", async () => {
    return {
      name: "AgentMesh Gateway",
      description: "Data Plane - Handles message forwarding, routing, streaming",
      version: app.config.VERSION,
      capabilities: {
        routing: ["round_robin", "least_loaded", "latency_aware", "weighted", "capability_match"],
        streaming: "sse (Phase 2)",
        loadBalancing: "health-aware, latency-aware (Phase 2)",
        rateLimiting: "per org/project/agent/skill (Phase 3)",
      },
      controlPlane: app.config.NATS_URL ? "connected via NATS (Phase 1+)" : "in-memory (Phase 0)",
    };
  });

  // Placeholder for A2A proxy - Phase 1+
  app.all("/a2a/*", async (req, reply) => {
    return reply.status(501).send({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "A2A Proxy will be implemented in Phase 1. This is Phase 0 foundation.",
        traceId: req.traceId,
      },
    });
  });

  // Placeholder for task streaming - Phase 2
  app.get("/tasks/:id/stream", async (req, reply) => {
    return reply.status(501).send({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Task streaming via SSE will be implemented in Phase 2",
        taskId: (req.params as any).id,
      },
    });
  });
}
