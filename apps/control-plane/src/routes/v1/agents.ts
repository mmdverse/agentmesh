import type { FastifyInstance } from "fastify";

export async function agentsRoutes(app: FastifyInstance) {
  // List agents
  app.get("/", async (req) => {
    const { skill, capability, region, limit = "20" } = req.query as any;
    return {
      agents: [],
      filter: { skill, capability, region, limit },
      message: "Agent Registry - full implementation in Phase 1. Will support capability filtering, ranking, health checks.",
      total: 0,
    };
  });

  // Get agent by id
  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.status(501).send({
      error: { code: "NOT_IMPLEMENTED", message: "Agent lookup - Phase 1" },
      id,
    });
  });

  // Get agent card
  app.get("/:id/card", async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.status(501).send({
      error: { code: "NOT_IMPLEMENTED", message: "Agent Card retrieval with caching, validation, signature verification - Phase 1" },
      id,
    });
  });

  // Register agent
  app.post("/", async (req, reply) => {
    const body = req.body as any;
    // Phase 0: just validate structure, don't persist
    return reply.status(501).send({
      error: { code: "NOT_IMPLEMENTED", message: "Agent registration - Phase 1 with Postgres + Redis + NATS events" },
      received: body?.name ?? "unknown",
    });
  });

  // Deregister
  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.status(501).send({
      error: { code: "NOT_IMPLEMENTED", message: "Agent deregistration - Phase 1" },
      id,
    });
  });

  // Health
  app.get("/:id/health", async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.status(501).send({
      error: { code: "NOT_IMPLEMENTED", message: "Health checks - Phase 1 with heartbeat + TTL" },
      id,
    });
  });
}
