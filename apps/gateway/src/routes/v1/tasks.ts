import type { FastifyInstance } from "fastify";

export async function tasksRoutes(app: FastifyInstance) {
  const controlPlaneUrl = process.env.CONTROL_PLANE_URL ?? "http://localhost:3002";

  // Helper to proxy to control-plane
  async function proxyToControlPlane(
    path: string,
    opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
  ) {
    const url = `${controlPlaneUrl}${path}`;
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // List tasks
  app.get("/", async (req, reply) => {
    const query = req.url.includes("?") ? req.url.split("?")[1] : "";
    const { status, data } = await proxyToControlPlane(`/v1/tasks?${query}`);
    return reply.status(status).send(data);
  });

  // Get task
  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, data } = await proxyToControlPlane(`/v1/tasks/${id}`);
    return reply.status(status).send(data);
  });

  // Create task - with routing
  app.post("/", async (req, reply) => {
    const body = req.body as any;
    if (!body?.agentId && (body?.skill || body?.capability)) {
      // If no agentId but skill provided, route to find agent
      try {
        const { getRegistryClient } = await import("../../modules/registry-client.js");
        const registry = getRegistryClient();
        const candidates = await registry.discover({
          skill: body.skill,
          capability: body.capability,
          region: body.region,
          limit: 10,
        });

        if (candidates.length === 0) {
          return reply.status(404).send({
            error: {
              code: "NO_AGENT_FOUND",
              message: `No agent found for skill=${body.skill} capability=${body.capability}`,
            },
          });
        }

        // Use routing engine
        const routingCandidates = candidates.map((a: any) => ({
          agent: a,
          health: a.health ?? "UNKNOWN",
          score: 1,
        }));
        const selected = app.routingEngine.route(
          routingCandidates as any,
          { skill: body.skill, capability: body.capability, region: body.region },
          body.strategy ?? "capability_match"
        );

        if (!selected) {
          return reply
            .status(404)
            .send({ error: { code: "ROUTING_FAILED", message: "Routing failed to select agent" } });
        }

        body.agentId = selected.agent.id;
        app.log.info(
          { routedTo: body.agentId, skill: body.skill, strategy: body.strategy },
          "task routed"
        );
      } catch (err) {
        app.log.error({ err }, "routing failed");
        return reply
          .status(500)
          .send({ error: { code: "ROUTING_FAILED", message: (err as Error).message } });
      }
    }

    const { status, data } = await proxyToControlPlane("/v1/tasks", { method: "POST", body });
    return reply.status(status).send(data);
  });

  // Cancel
  app.post("/:id/cancel", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, data } = await proxyToControlPlane(`/v1/tasks/${id}/cancel`, {
      method: "POST",
      body: req.body,
    });
    return reply.status(status).send(data);
  });

  // Complete (for agents to report)
  app.post("/:id/complete", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, data } = await proxyToControlPlane(`/v1/tasks/${id}/complete`, {
      method: "POST",
      body: req.body,
    });
    return reply.status(status).send(data);
  });

  // Fail
  app.post("/:id/fail", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, data } = await proxyToControlPlane(`/v1/tasks/${id}/fail`, {
      method: "POST",
      body: req.body,
    });
    return reply.status(status).send(data);
  });

  // Retry
  app.post("/:id/retry", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, data } = await proxyToControlPlane(`/v1/tasks/${id}/retry`, { method: "POST" });
    return reply.status(status).send(data);
  });

  // History
  app.get("/:id/history", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, data } = await proxyToControlPlane(`/v1/tasks/${id}/history`);
    return reply.status(status).send(data);
  });

  // Graph
  app.get("/:id/graph", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, data } = await proxyToControlPlane(`/v1/tasks/${id}/graph`);
    return reply.status(status).send(data);
  });

  // Streaming - proxy SSE
  app.get("/:id/stream", async (req, reply) => {
    const { id } = req.params as { id: string };
    const url = `${controlPlaneUrl}/v1/tasks/${id}/stream`;

    try {
      const res = await fetch(url, {
        headers: { Accept: "text/event-stream" },
      });

      if (!res.ok || !res.body) {
        return reply.status(res.status).send({
          error: {
            code: "STREAM_FAILED",
            message: `Failed to connect to task stream: ${res.status}`,
          },
        });
      }

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      // Forward stream
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          reply.raw.write(chunk);
        }
      } catch (err) {
        app.log.warn({ err, taskId: id }, "stream forwarding error");
      } finally {
        try {
          reply.raw.end();
        } catch {}
      }

      return reply;
    } catch (err) {
      return reply
        .status(502)
        .send({ error: { code: "STREAM_PROXY_FAILED", message: (err as Error).message } });
    }
  });
}
