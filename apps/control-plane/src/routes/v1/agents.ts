import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRegistryService } from "../../modules/registry/service.js";
import { getDiscovery } from "../../modules/discovery/index.js";

const RegisterSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  url: z.string().url(),
  version: z.string().optional(),
  providerOrganization: z.string().optional(),
  trustLevel: z.enum(["UNTRUSTED", "EXTERNAL", "VERIFIED", "ORGANIZATION", "SYSTEM"]).optional(),
  region: z.string().optional(),
  environment: z.enum(["development", "staging", "production"]).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  card: z.record(z.unknown()).optional(),
  fetchCard: z.boolean().optional(),
  ttlSeconds: z.number().int().positive().optional(),
});

export async function agentsRoutes(app: FastifyInstance) {
  const registry = getRegistryService();
  const discovery = getDiscovery();

  // List agents with filtering
  app.get("/", async (req) => {
    const { skill, capability, region, trustLevel, health, search, tags, limit = "20", offset = "0", organizationId, projectId } = req.query as any;

    const filter = {
      skill: skill as string | undefined,
      capability: capability as string | undefined,
      region: region as string | undefined,
      trustLevel: trustLevel as string | undefined,
      health: health as string | undefined,
      search: search as string | undefined,
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
      organizationId: organizationId as string | undefined,
      projectId: projectId as string | undefined,
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0,
    };

    const { agents, total } = await registry.list(filter);

    return {
      agents,
      total,
      limit: filter.limit,
      offset: filter.offset,
      filter: { skill, capability, region, search },
    };
  });

  // Discovery endpoint - composite discovery
  app.get("/discover", async (req) => {
    const { skill, capability, region, search, url, baseUrl, limit = "20" } = req.query as any;

    const agents = await discovery.discover({
      skill,
      capability,
      region,
      search,
      url,
      baseUrl,
      limit: parseInt(limit, 10) || 20,
    });

    return {
      agents,
      total: agents.length,
      query: { skill, capability, region, search, url, baseUrl },
    };
  });

  // Get agent by id
  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { includeCard } = req.query as any;

    try {
      const agent = await registry.getById(id, { includeCard: includeCard === "true" });
      return { agent };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 404).send({ error: { code: e.code ?? "NOT_FOUND", message: e.message } });
    }
  });

  // Get agent card
  app.get("/:id/card", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { refresh } = req.query as any;

    try {
      const result = await registry.getCard(id, { forceRefresh: refresh === "true" });
      return {
        card: result.card,
        fetchedAt: result.fetchedAt,
        fromCache: result.fromCache,
        agentId: id,
      };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "FETCH_FAILED", message: e.message } });
    }
  });

  // Register agent
  app.post("/", async (req, reply) => {
    try {
      const parsed = RegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } });
      }

      const agent = await registry.register(parsed.data as any);
      return reply.status(201).send({ agent });
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "REGISTRATION_FAILED", message: e.message, details: e.details } });
    }
  });

  // Update agent
  app.patch("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const parsed = RegisterSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } });
      }

      const agent = await registry.update(id, parsed.data as any);
      return { agent };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "UPDATE_FAILED", message: e.message } });
    }
  });

  // Deregister
  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await registry.delete(id);
      return { success: true, id };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "DELETE_FAILED", message: e.message } });
    }
  });

  // Health
  app.get("/:id/health", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const agent = await registry.getById(id);
      return {
        agentId: id,
        health: agent.health,
        lastSeenAt: agent.lastSeenAt,
        url: agent.url,
        trustLevel: agent.trustLevel,
      };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 404).send({ error: { code: e.code ?? "NOT_FOUND", message: e.message } });
    }
  });

  // Heartbeat
  app.post("/:id/heartbeat", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await registry.heartbeat(id);
      return { success: true, id, timestamp: new Date().toISOString() };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "HEARTBEAT_FAILED", message: e.message } });
    }
  });

  // Update health manually
  app.post("/:id/health", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { health, latencyMs } = req.body as any;

    if (!["HEALTHY", "DEGRADED", "UNHEALTHY", "UNKNOWN"].includes(health)) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid health value" } });
    }

    try {
      await registry.updateHealth(id, health, latencyMs);
      return { success: true, id, health, latencyMs };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "HEALTH_UPDATE_FAILED", message: e.message } });
    }
  });
}
