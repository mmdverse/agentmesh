import type { FastifyInstance } from "fastify";
import { agentsRoutes } from "./agents.js";
import { tasksRoutes } from "./tasks.js";
import { artifactsRoutes } from "./artifacts.js";
import { messagesRoutes } from "./messages.js";
import { webhooksRoutes } from "./webhooks.js";
import { mcpRoutes } from "./mcp.js";
import { extraRoutes } from "./extra.js";

export async function v1Routes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "control-plane",
      version: app.config.VERSION,
      components: {
        registry: "Phase 1+3 with versioning+tenancy",
        routing: "Phase 2+4",
        tasks: "Phase 2+3+4 with reliability",
        policies: "Phase 3",
        events: "Phase 4 NATS JetStream with fallback",
        artifacts: "Phase 4 S3+InMemory with lifecycle",
        messaging: "Phase 4 sync/async/streaming",
        webhooks: "Phase 4 signed+retry+SSRF protection",
        mcpBridge: "Phase 4 A2A<->MCP",
        observability: "Phase 4 OTel+InMemory",
      },
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/info", async () => {
    return {
      name: "AgentMesh Control Plane",
      description:
        "Registry, Policies, Configuration, Identity, Artifacts, Messaging, Webhooks, MCP Bridge, Observability",
      version: app.config.VERSION,
      dataPlane: "Gateway cluster (separate) with circuit breakers, bulkheads, rate limiting",
      storage: {
        postgres: "source of truth (with InMemory fallback)",
        redis: "cache, health, rate limiting, coordination",
        nats: "event bus JetStream + task queue",
        s3: "artifacts (with InMemory fallback)",
      },
      features: [
        "Agent Registry with versioning",
        "Multi-tenancy with strict isolation",
        "Task Orchestration with delegation tree",
        "Message Routing sync/async/streaming",
        "Artifact Management with S3",
        "MCP Bridge A2A<->MCP",
        "Webhooks with signing+retry+SSRF",
        "Observability with OTel tracing",
        "Reliability: CircuitBreaker, Bulkhead, Retry, FanOutLimiter",
        "Security: ApiKey, JWT, OIDC, mTLS, Workload Identity",
      ],
    };
  });

  await app.register(agentsRoutes, { prefix: "/agents" });
  await app.register(tasksRoutes, { prefix: "/tasks" });
  await app.register(artifactsRoutes, { prefix: "/artifacts" });
  await app.register(messagesRoutes, { prefix: "/messages" });
  await app.register(webhooksRoutes, { prefix: "/webhooks" });
  await app.register(mcpRoutes, { prefix: "/mcp" });
  await app.register(extraRoutes, { prefix: "/" });

  // Observability
  app.get("/observability/traces/:traceId", async (req, reply) => {
    const { traceId } = req.params as { traceId: string };
    try {
      const { getObservability } = await import("@agentmesh/observability");
      const obs = getObservability();
      const trace = obs.getTrace(traceId);
      if (trace.length === 0) {
        return reply
          .status(404)
          .send({ error: { code: "NOT_FOUND", message: `Trace ${traceId} not found` } });
      }
      return { traceId, spans: trace, total: trace.length };
    } catch (err) {
      return reply
        .status(500)
        .send({ error: { code: "FETCH_FAILED", message: (err as Error).message } });
    }
  });

  app.get("/observability/metrics", async req => {
    const { name } = req.query as any;
    const { getObservability } = await import("@agentmesh/observability");
    const obs = getObservability();
    const metrics = obs.getMetrics(name);
    return { metrics, total: metrics.length, filter: { name } };
  });

  app.get("/observability/spans", async () => {
    const { getObservability } = await import("@agentmesh/observability");
    const obs = getObservability();
    const spans = obs.getAllSpans();
    return { spans: spans.slice(-100), total: spans.length };
  });

  // Legacy placeholder kept only for events (not duplicated in extra)
  app.get("/registry", async () => ({ message: "Use /v1/agents for registry - Phase 4" }));
  app.get("/events", async () => ({ message: "Events via NATS JetStream - Phase 4" }));
}
