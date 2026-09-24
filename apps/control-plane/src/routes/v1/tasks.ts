import type { FastifyInstance } from "fastify";

export async function tasksRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const { state, agentId, limit = "20" } = req.query as any;
    return {
      tasks: [],
      filter: { state, agentId, limit },
      message: "Task list - Phase 2 with Postgres persistence, filtering by state, tenant isolation",
      total: 0,
    };
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.status(501).send({
      error: { code: "NOT_IMPLEMENTED", message: "Task lookup - Phase 2 with history, delegation tree" },
      id,
    });
  });

  app.post("/", async (req, reply) => {
    const body = req.body as any;
    return reply.status(501).send({
      error: { code: "NOT_IMPLEMENTED", message: "Task creation - Phase 2 with routing, event publishing" },
      received: body,
    });
  });

  app.post("/:id/cancel", async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.status(501).send({
      error: { code: "NOT_IMPLEMENTED", message: "Task cancellation - Phase 2" },
      id,
    });
  });

  app.get("/:id/history", async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.status(501).send({
      error: { code: "NOT_IMPLEMENTED", message: "Task history - Phase 2" },
      id,
    });
  });

  app.get("/:id/graph", async (req, reply) => {
    const { id } = req.params as { id: string };
    return reply.status(501).send({
      error: { code: "NOT_IMPLEMENTED", message: "Delegation graph reconstruction - Phase 2" },
      id,
    });
  });
}
