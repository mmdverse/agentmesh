import type { FastifyInstance } from "fastify";
import { getRegistryClient } from "../../modules/registry-client.js";
import { getA2AProxy } from "../../modules/a2a-proxy.js";
import { tasksRoutes } from "./tasks.js";

export async function v1Routes(app: FastifyInstance) {
  const registry = getRegistryClient();
  const proxy = getA2AProxy();

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "gateway",
      version: app.config.VERSION,
      dataPlane: "active",
      controlPlane: "cached-config (Phase 2: Redis + Control Plane HTTP + Tasks)",
      routingStrategies: app.routingEngine.listStrategies(),
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/routes", async () => {
    return {
      routes: [],
      message: "Routing table - Phase 2: engine integrated with task creation",
    };
  });

  app.get("/info", async () => {
    return {
      name: "AgentMesh Gateway",
      description: "Data Plane - Handles message forwarding, routing, streaming",
      version: app.config.VERSION,
      capabilities: {
        routing: ["round_robin", "least_loaded", "latency_aware", "weighted", "capability_match"],
        streaming: "sse (Phase 2: implemented)",
        loadBalancing: "health-aware, latency-aware (Phase 2)",
        rateLimiting: "per org/project/agent/skill (Phase 3)",
        discovery: ["local_registry", "direct_url", "well_known", "manual"],
        a2aProxy: "Phase 1: JSON-RPC forwarding with SSRF protection",
        tasks: "Phase 2: creation with routing, SSE streaming, delegation graph",
      },
      controlPlane: app.config.NATS_URL ? "connected via NATS (Phase 2)" : "in-memory",
    };
  });

  // Agent discovery via gateway (proxies to control-plane)
  app.get("/agents", async (req) => {
    const { skill, capability, region, search, limit = "20" } = req.query as any;
    const agents = await registry.discover({
      skill,
      capability,
      region,
      search,
      limit: parseInt(limit, 10) || 20,
    });
    return { agents, total: agents.length, source: "gateway->control-plane" };
  });

  app.get("/agents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = await registry.getAgent(id);
    if (!agent) {
      return reply.status(404).send({ error: { code: "AGENT_NOT_FOUND", message: `Agent not found: ${id}` } });
    }
    return { agent };
  });

  // A2A Proxy - Forward JSON-RPC to agent
  app.post("/agents/:id/invoke", async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = await registry.getAgent(id);
    if (!agent) {
      return reply.status(404).send({ error: { code: "AGENT_NOT_FOUND", message: `Agent not found: ${id}` } });
    }

    const body = req.body as any;
    if (!body || !body.method) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid JSON-RPC request, missing method" } });
    }

    try {
      const result = await proxy.forward(
        {
          url: agent.url,
          method: "POST",
          body,
          traceId: req.traceId,
          headers: {
            "X-AgentMesh-Agent-Id": id,
            "X-AgentMesh-Trace-Id": req.traceId,
          },
        },
        { timeoutMs: app.config.REQUEST_TIMEOUT_MS, retries: 0, allowPrivate: true }
      );

      try {
        await app.eventBus.publish({
          id: `evt_${Date.now()}`,
          type: "message.sent",
          source: "gateway",
          subject: `agent.${id}`,
          data: { agentId: id, method: body.method, status: result.status, latencyMs: result.latencyMs },
          timestamp: new Date().toISOString(),
          traceId: req.traceId,
        });
      } catch {}

      return reply.status(result.status).send(result.body);
    } catch (err) {
      const e = err as Error;
      app.log.error({ err: e, agentId: id, traceId: req.traceId }, "A2A proxy failed");
      return reply.status(502).send({ error: { code: "PROXY_FAILED", message: e.message, agentId: id, traceId: req.traceId } });
    }
  });

  // Generic A2A proxy - /v1/a2a/:id/* -> forwards to agent
  app.all("/a2a/:id/*", async (req, reply) => {
    const { id } = req.params as { id: string; "*": string };
    const agent = await registry.getAgent(id);
    if (!agent) {
      return reply.status(404).send({ error: { code: "AGENT_NOT_FOUND", message: `Agent not found: ${id}` } });
    }

    const extraPath = (req.params as any)["*"] ?? "";
    const targetUrl = `${agent.url.replace(/\/$/, "")}/${extraPath}`.replace(/\/$/, "");
    const queryString = req.url.includes("?") ? req.url.split("?")[1] : "";
    const finalUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

    try {
      const result = await proxy.forward(
        {
          url: finalUrl,
          method: req.method,
          body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
          traceId: req.traceId,
        },
        { timeoutMs: app.config.REQUEST_TIMEOUT_MS, allowPrivate: true }
      );

      for (const [k, v] of Object.entries(result.headers)) {
        if (!["content-length", "transfer-encoding"].includes(k.toLowerCase())) {
          reply.header(k, v);
        }
      }

      return reply.status(result.status).send(result.body);
    } catch (err) {
      const e = err as Error;
      return reply.status(502).send({ error: { code: "PROXY_FAILED", message: e.message, agentId: id } });
    }
  });

  // Routing preview - Phase 2 with real routing
  app.post("/route", async (req) => {
    const { skill, capability, region, strategy = "capability_match" } = req.body as any;
    const candidates = await registry.discover({ skill, capability, region, limit: 50 });

    if (candidates.length === 0) {
      return { agent: null, candidates: [], message: "No agents found for criteria" };
    }

    const routingCandidates = candidates.map((a) => ({
      agent: a as any,
      health: (a as any).health ?? "UNKNOWN",
      score: 1,
    }));

    const selected = app.routingEngine.route(routingCandidates as any, { skill, capability, region }, strategy);

    return {
      agent: selected?.agent ?? null,
      candidates: candidates.slice(0, 10),
      strategy,
      total: candidates.length,
    };
  });

  // Register tasks routes - Phase 2
  await app.register(tasksRoutes, { prefix: "/tasks" });
}
