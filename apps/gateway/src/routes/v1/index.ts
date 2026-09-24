import type { FastifyInstance } from "fastify";
import { getRegistryClient } from "../../modules/registry-client.js";
import { getA2AProxy } from "../../modules/a2a-proxy.js";
import { tasksRoutes } from "./tasks.js";
import { getObservability } from "@agentmesh/observability";

export async function v1Routes(app: FastifyInstance) {
  const registry = getRegistryClient();
  const proxy = getA2AProxy();

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "gateway",
      version: app.config.VERSION,
      dataPlane: "active",
      controlPlane: "cached-config + Redis + NATS JetStream",
      routingStrategies: app.routingEngine.listStrategies(),
      features: {
        reliability: "CircuitBreaker, Bulkhead, Retry, Timeout",
        security: "Auth, RateLimit, Tenant Isolation, Policy",
        artifacts: "S3 + InMemory",
        messaging: "sync/async/streaming",
        webhooks: "signed + retry + SSRF protection",
        mcpBridge: "A2A<->MCP",
        observability: "OTel + InMemory tracing",
      },
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/info", async () => {
    return {
      name: "AgentMesh Gateway",
      description:
        "Data Plane - Handles message forwarding, routing, streaming, artifacts, messaging",
      version: app.config.VERSION,
      capabilities: {
        routing: ["round_robin", "least_loaded", "latency_aware", "weighted", "capability_match"],
        streaming: "sse with event bus",
        loadBalancing: "health-aware, latency-aware, capacity-aware",
        rateLimiting: "per org/project/agent/skill/endpoint/ip/global",
        discovery: ["local_registry", "direct_url", "well_known", "manual", "mcp_bridge"],
        a2aProxy: "JSON-RPC forwarding with SSRF protection + circuit breaker",
        tasks: "creation with routing, SSE streaming, delegation graph, reliability",
        artifacts: "S3 + presigned URLs + lifecycle",
        messaging: "sync/async/streaming with trace propagation",
        webhooks: "signed delivery + retry + dead-letter",
        mcpBridge: "A2A<->MCP translation",
        observability: "OTel tracing + metrics",
      },
      controlPlane: app.config.NATS_URL ? "connected via NATS JetStream" : "in-memory",
    };
  });

  app.get("/agents", async req => {
    const {
      skill,
      capability,
      region,
      search,
      limit = "20",
      versionStrategy,
      version,
    } = req.query as any;
    const tenant = (req as any).tenant ?? {};

    const agents = await registry.discover({
      skill,
      capability,
      region,
      search,
      limit: parseInt(limit, 10) || 20,
    });

    // Apply tenant filter
    let filtered = agents;
    if (tenant.organizationId) {
      filtered = filtered.filter(
        (a: any) => !a.organizationId || a.organizationId === tenant.organizationId
      );
    }

    return {
      agents: filtered,
      total: filtered.length,
      source: "gateway->control-plane",
      tenant,
      versionStrategy,
      version,
    };
  });

  app.get("/agents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = await registry.getAgent(id);
    if (!agent) {
      return reply
        .status(404)
        .send({ error: { code: "AGENT_NOT_FOUND", message: `Agent not found: ${id}` } });
    }
    return { agent };
  });

  app.post("/agents/:id/invoke", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenant = (req as any).tenant ?? {};
    const obs = getObservability();
    const span = obs["tracer"].startSpan(`gateway.invoke.${id}`, {
      attributes: { agentId: id, traceId: req.traceId, organizationId: tenant.organizationId },
    });

    const agent = await registry.getAgent(id);
    if (!agent) {
      obs.endSpan(span.id, { error: new Error(`Agent ${id} not found`) });
      return reply
        .status(404)
        .send({ error: { code: "AGENT_NOT_FOUND", message: `Agent not found: ${id}` } });
    }

    const body = req.body as any;
    if (!body || !body.method) {
      obs.endSpan(span.id, { error: new Error("Invalid JSON-RPC") });
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid JSON-RPC request, missing method" },
      });
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
            "X-Organization-Id": tenant.organizationId ?? "",
            "X-Project-Id": tenant.projectId ?? "",
          },
        },
        { timeoutMs: app.config.REQUEST_TIMEOUT_MS, retries: 0, allowPrivate: true }
      );

      obs.endSpan(span.id, { attributes: { status: result.status, latency: result.latencyMs } });

      try {
        await app.eventBus.publish({
          id: `evt_${Date.now()}`,
          type: "message.sent",
          source: "gateway",
          subject: `agent.${id}`,
          data: {
            agentId: id,
            method: body.method,
            status: result.status,
            latencyMs: result.latencyMs,
          },
          timestamp: new Date().toISOString(),
          traceId: req.traceId,
          organizationId: tenant.organizationId,
          projectId: tenant.projectId,
        });
      } catch {}

      return reply.status(result.status).send(result.body);
    } catch (err) {
      const e = err as Error;
      obs.endSpan(span.id, { error: e });
      app.log.error({ err: e, agentId: id, traceId: req.traceId }, "A2A proxy failed");
      return reply.status(502).send({
        error: { code: "PROXY_FAILED", message: e.message, agentId: id, traceId: req.traceId },
      });
    }
  });

  app.all("/a2a/:id/*", async (req, reply) => {
    const { id } = req.params as { id: string; "*": string };
    const agent = await registry.getAgent(id);
    if (!agent) {
      return reply
        .status(404)
        .send({ error: { code: "AGENT_NOT_FOUND", message: `Agent not found: ${id}` } });
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
      return reply
        .status(502)
        .send({ error: { code: "PROXY_FAILED", message: e.message, agentId: id } });
    }
  });

  app.post("/route", async req => {
    const {
      skill,
      capability,
      region,
      strategy = "capability_match",
      versionStrategy,
      version,
    } = req.body as any;
    const tenant = (req as any).tenant ?? {};
    const candidates = await registry.discover({ skill, capability, region, limit: 50 });

    let filtered = candidates;
    if (tenant.organizationId) {
      filtered = filtered.filter(
        (a: any) => !a.organizationId || a.organizationId === tenant.organizationId
      );
    }

    if (filtered.length === 0) {
      return { agent: null, candidates: [], message: "No agents found for criteria" };
    }

    const routingCandidates = filtered.map(a => ({
      agent: a as any,
      health: (a as any).health ?? "UNKNOWN",
      score: 1,
    }));

    const selected = app.routingEngine.route(
      routingCandidates as any,
      { skill, capability, region, tenant },
      strategy
    );

    return {
      agent: selected?.agent ?? null,
      candidates: filtered.slice(0, 10),
      strategy,
      total: filtered.length,
      versionStrategy,
      version,
    };
  });

  await app.register(tasksRoutes, { prefix: "/tasks" });

  // Artifacts proxy to control-plane (or handle via gateway for direct upload)
  app.get("/artifacts", async (req, reply) => {
    // Proxy to control-plane
    const controlPlaneUrl = process.env.CONTROL_PLANE_URL ?? "http://localhost:3002";
    try {
      const query = req.url.includes("?") ? `?${req.url.split("?")[1]}` : "";
      const res = await fetch(`${controlPlaneUrl}/v1/artifacts${query}`, {
        headers: {
          "X-Organization-Id": (req as any).tenant?.organizationId ?? "",
          "X-Project-Id": (req as any).tenant?.projectId ?? "",
          Authorization: (req.headers["authorization"] as string) ?? "",
        },
      });
      const data = await res.json();
      return reply.status(res.status).send(data);
    } catch (err) {
      return reply
        .status(502)
        .send({ error: { code: "PROXY_FAILED", message: (err as Error).message } });
    }
  });

  // Messages
  app.get("/messages", async (req, reply) => {
    const controlPlaneUrl = process.env.CONTROL_PLANE_URL ?? "http://localhost:3002";
    try {
      const query = req.url.includes("?") ? `?${req.url.split("?")[1]}` : "";
      const res = await fetch(`${controlPlaneUrl}/v1/messages${query}`, {
        headers: {
          "X-Organization-Id": (req as any).tenant?.organizationId ?? "",
          "X-Project-Id": (req as any).tenant?.projectId ?? "",
          Authorization: (req.headers["authorization"] as string) ?? "",
        },
      });
      const data = await res.json();
      return reply.status(res.status).send(data);
    } catch (err) {
      return reply
        .status(502)
        .send({ error: { code: "PROXY_FAILED", message: (err as Error).message } });
    }
  });

  // Observability - traces via gateway
  app.get("/observability/traces/:traceId", async req => {
    const { traceId } = req.params as { traceId: string };
    const obs = getObservability();
    const trace = obs.getTrace(traceId);
    return { traceId, spans: trace, total: trace.length, source: "gateway" };
  });

  app.get("/observability/metrics", async req => {
    const { name } = req.query as any;
    const obs = getObservability();
    const metrics = obs.getMetrics(name);
    return { metrics, total: metrics.length, source: "gateway" };
  });

  // MCP Bridge discovery via gateway
  app.get("/mcp/servers", async (req, reply) => {
    const controlPlaneUrl = process.env.CONTROL_PLANE_URL ?? "http://localhost:3002";
    try {
      const res = await fetch(`${controlPlaneUrl}/v1/mcp/servers`, {
        headers: {
          "X-Organization-Id": (req as any).tenant?.organizationId ?? "",
          Authorization: (req.headers["authorization"] as string) ?? "",
        },
      });
      const data = await res.json();
      return reply.status(res.status).send(data);
    } catch (err) {
      return reply
        .status(502)
        .send({ error: { code: "PROXY_FAILED", message: (err as Error).message } });
    }
  });
}
