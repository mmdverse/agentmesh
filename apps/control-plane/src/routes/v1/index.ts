import type { FastifyInstance } from "fastify";
import { agentsRoutes } from "./agents.js";
import { tasksRoutes } from "./tasks.js";

export async function v1Routes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "control-plane",
      version: app.config.VERSION,
      components: {
        registry: "Phase 1",
        routing: "Phase 2",
        tasks: "Phase 2",
        policies: "Phase 3",
        events: "Phase 0 - InMemory, Phase 1 - NATS JetStream",
      },
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/info", async () => {
    return {
      name: "AgentMesh Control Plane",
      description: "Registry, Policies, Configuration, Identity, Admin API",
      version: app.config.VERSION,
      dataPlane: "Gateway cluster (separate)",
      storage: {
        postgres: "source of truth",
        redis: "cache, health, rate limiting",
        nats: "event bus + task queue",
        s3: "artifacts",
      },
    };
  });

  await app.register(agentsRoutes, { prefix: "/agents" });
  await app.register(tasksRoutes, { prefix: "/tasks" });

  // Placeholder routes for Phase 1+
  app.get("/registry", async () => ({ message: "Registry overview - Phase 1" }));
  app.get("/routes", async () => ({ routes: [], message: "Routes - Phase 2" }));
  app.get("/policies", async () => ({ policies: [], message: "Policies - Phase 3" }));
  app.get("/events", async () => ({ events: [], message: "Events - Phase 1 with NATS" }));
  app.get("/organizations", async () => ({ organizations: [], message: "Multi-tenancy - Phase 3" }));
  app.get("/artifacts", async () => ({ artifacts: [], message: "Artifacts - Phase 2" }));
}
