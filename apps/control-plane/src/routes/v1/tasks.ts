import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getTaskService } from "../../modules/tasks/service.js";

const CreateTaskSchema = z.object({
  agentId: z.string().min(1),
  message: z.object({
    text: z.string().min(1),
    role: z.enum(["user", "agent"]).optional(),
    parts: z.array(z.any()).optional(),
  }),
  contextId: z.string().optional(),
  sessionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  parentTaskId: z.string().optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  traceId: z.string().optional(),
});

export async function tasksRoutes(app: FastifyInstance) {
  const service = getTaskService();

  app.get("/", async (req) => {
    const { state, agentId, contextId, traceId, rootTaskId, organizationId, projectId, limit = "20", offset = "0" } = req.query as any;

    const filter = {
      state,
      agentId,
      contextId,
      traceId,
      rootTaskId,
      organizationId,
      projectId,
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0,
    };

    const { tasks, total } = await service.list(filter as any);

    return { tasks, total, limit: filter.limit, offset: filter.offset };
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const task = await service.getById(id);
      return { task };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 404).send({ error: { code: e.code ?? "NOT_FOUND", message: e.message } });
    }
  });

  app.post("/", async (req, reply) => {
    try {
      const parsed = CreateTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } });
      }

      const task = await service.create(parsed.data as any);
      return reply.status(201).send({ task });
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "CREATE_FAILED", message: e.message } });
    }
  });

  app.post("/:id/cancel", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { reason } = (req.body as any) ?? {};
    try {
      const task = await service.cancel(id, reason);
      return { task };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "CANCEL_FAILED", message: e.message } });
    }
  });

  app.post("/:id/complete", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { output } = (req.body as any) ?? {};
    try {
      const task = await service.complete(id, output);
      return { task };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "COMPLETE_FAILED", message: e.message } });
    }
  });

  app.post("/:id/fail", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { error } = (req.body as any) ?? {};
    if (!error?.message) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "error.message required" } });
    }
    try {
      const task = await service.fail(id, error);
      return { task };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "FAIL_FAILED", message: e.message } });
    }
  });

  app.post("/:id/retry", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const task = await service.retry(id);
      return { task };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "RETRY_FAILED", message: e.message } });
    }
  });

  app.get("/:id/history", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const history = await service.getHistory(id);
      return { taskId: id, history };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "HISTORY_FAILED", message: e.message } });
    }
  });

  app.get("/:id/graph", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { tree, graph } = await service.getDelegationTree(id);
      return { taskId: id, tree, graph };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "GRAPH_FAILED", message: e.message } });
    }
  });

  // SSE Streaming for task updates - Phase 2
  app.get("/:id/stream", async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      await service.getById(id); // ensure exists
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 404).send({ error: { code: e.code ?? "NOT_FOUND", message: e.message } });
    }

    // Setup SSE
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const sendEvent = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial task state
    try {
      const task = await service.getById(id);
      sendEvent("task", task);
    } catch {}

    // Subscribe to task events via event bus
    const { createEventBus } = await import("@agentmesh/events");
    const eventBus = createEventBus({ serviceName: "control-plane-stream" });

    const sub = await eventBus.subscribe("*", (event: any) => {
      if (event.subject === `task.${id}` || event.data?.task?.id === id) {
        const type = event.type.replace("task.", "");
        sendEvent(type, event.data);
        // If terminal, close after a delay
        if (["completed", "failed", "canceled", "timeout"].includes(type)) {
          setTimeout(() => {
            try {
              reply.raw.end();
            } catch {}
          }, 1000);
        }
      }
    });

    // Heartbeat every 15s
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`: heartbeat ${new Date().toISOString()}\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    // Polling fallback - check task state every 2s and send if changed
    let lastState: string | null = null;
    const poll = setInterval(async () => {
      try {
        const task = await service.getById(id);
        if (task.state !== lastState) {
          lastState = task.state;
          sendEvent("state", { state: task.state, task });
          if (["COMPLETED", "FAILED", "CANCELED", "REJECTED", "TIMEOUT"].includes(task.state)) {
            clearInterval(poll);
            setTimeout(() => {
              try {
                reply.raw.end();
              } catch {}
            }, 500);
          }
        }
      } catch {
        // Task deleted? close
        clearInterval(poll);
        try {
          reply.raw.end();
        } catch {}
      }
    }, 2000);

    req.raw.on("close", async () => {
      clearInterval(heartbeat);
      clearInterval(poll);
      try {
        await sub.unsubscribe();
        await eventBus.close();
      } catch {}
      try {
        reply.raw.end();
      } catch {}
    });

    // Don't return, keep connection open
    return reply;
  });
}
