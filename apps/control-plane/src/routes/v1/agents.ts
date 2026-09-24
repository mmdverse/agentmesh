import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRegistryService } from "../../modules/registry/service.js";
import { getDiscovery } from "../../modules/discovery/index.js";
import type { VersionConstraint } from "@agentmesh/versioning";

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

  app.get("/", async req => {
    const {
      skill,
      capability,
      region,
      trustLevel,
      health,
      search,
      tags,
      limit = "20",
      offset = "0",
      organizationId,
      projectId,
      version,
      versionStrategy,
      minVersion,
      versionRange,
    } = req.query as any;

    const tenant = (req as any).tenant ?? {};

    let versionConstraint: VersionConstraint | undefined;
    if (versionStrategy) {
      versionConstraint = {
        strategy: versionStrategy,
        version: version ?? minVersion,
        range: versionRange,
      };
    } else if (version) {
      // exact version filter
    } else if (minVersion) {
      versionConstraint = { strategy: "minimum", version: minVersion };
    } else if (versionRange) {
      versionConstraint = { strategy: "max_satisfying", range: versionRange };
    }

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
      version: version as string | undefined,
      versionStrategy: versionStrategy as any,
      minVersion: minVersion as string | undefined,
      versionRange: versionRange as string | undefined,
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0,
      tenant,
      versionConstraint,
    };

    const { agents, total } = await registry.list(filter as any);

    return {
      agents,
      total,
      limit: filter.limit,
      offset: filter.offset,
      filter: { skill, capability, region, search, version, versionStrategy },
    };
  });

  app.get("/discover", async req => {
    const {
      skill,
      capability,
      region,
      search,
      url,
      baseUrl,
      limit = "20",
      versionStrategy,
      version,
      minVersion,
    } = req.query as any;
    const tenant = (req as any).tenant ?? {};

    let versionConstraint: VersionConstraint | undefined;
    if (versionStrategy) {
      versionConstraint = {
        strategy: versionStrategy,
        version,
        range: req.query as any["versionRange"],
      };
    }

    // If version constraint, use registry's discoverBest or list with versioning
    if (versionConstraint && skill) {
      const best = await registry.discoverBest(skill, versionConstraint, tenant);
      return {
        agents: best ? [best] : [],
        total: best ? 1 : 0,
        query: { skill, capability, region, search, url, baseUrl, versionStrategy, version },
        strategy: "version-aware",
      };
    }

    const agents = await discovery.discover({
      skill,
      capability,
      region,
      search,
      url,
      baseUrl,
      limit: parseInt(limit, 10) || 20,
    });

    // Apply tenant filter if present
    let filtered = agents;
    if (tenant.organizationId) {
      filtered = filtered.filter(
        (a: any) => !a.organizationId || a.organizationId === tenant.organizationId
      );
    }
    if (tenant.projectId) {
      filtered = filtered.filter((a: any) => !a.projectId || a.projectId === tenant.projectId);
    }

    return {
      agents: filtered,
      total: filtered.length,
      query: { skill, capability, region, search, url, baseUrl },
    };
  });

  // List versions for a name
  app.get("/versions/:name", async req => {
    const { name } = req.params as { name: string };
    const tenant = (req as any).tenant ?? {};
    const { versions, agents } = await registry.listVersions(name, tenant);
    return { name, versions, agents, total: versions.length };
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { includeCard } = req.query as any;
    const tenant = (req as any).tenant ?? {};

    try {
      const agent = await registry.getById(id, { includeCard: includeCard === "true", tenant });
      return { agent };
    } catch (err) {
      const e = err as any;
      return reply
        .status(e.statusCode ?? 404)
        .send({ error: { code: e.code ?? "NOT_FOUND", message: e.message } });
    }
  });

  app.get("/:id/card", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { refresh } = req.query as any;
    const tenant = (req as any).tenant ?? {};

    try {
      const result = await registry.getCard(id, { forceRefresh: refresh === "true", tenant });
      return {
        card: result.card,
        fetchedAt: result.fetchedAt,
        fromCache: result.fromCache,
        agentId: id,
      };
    } catch (err) {
      const e = err as any;
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: { code: e.code ?? "FETCH_FAILED", message: e.message } });
    }
  });

  app.post("/", async (req, reply) => {
    try {
      const parsed = RegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        });
      }

      const tenant = (req as any).tenant ?? {};
      const agent = await registry.register({ ...(parsed.data as any), tenant });
      return reply.status(201).send({ agent });
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({
        error: { code: e.code ?? "REGISTRATION_FAILED", message: e.message, details: e.details },
      });
    }
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const parsed = RegisterSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        });
      }

      const tenant = (req as any).tenant ?? {};
      const agent = await registry.update(id, { ...(parsed.data as any), tenant });
      return { agent };
    } catch (err) {
      const e = err as any;
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: { code: e.code ?? "UPDATE_FAILED", message: e.message } });
    }
  });

  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const tenant = (req as any).tenant ?? {};
      await registry.delete(id, tenant);
      return { success: true, id };
    } catch (err) {
      const e = err as any;
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: { code: e.code ?? "DELETE_FAILED", message: e.message } });
    }
  });

  app.get("/:id/health", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenant = (req as any).tenant ?? {};
    try {
      const agent = await registry.getById(id, { tenant });
      return {
        agentId: id,
        health: agent.health,
        lastSeenAt: agent.lastSeenAt,
        url: agent.url,
        trustLevel: agent.trustLevel,
      };
    } catch (err) {
      const e = err as any;
      return reply
        .status(e.statusCode ?? 404)
        .send({ error: { code: e.code ?? "NOT_FOUND", message: e.message } });
    }
  });

  app.post("/:id/heartbeat", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenant = (req as any).tenant ?? {};
    try {
      // Verify tenant access first
      await registry.getById(id, { tenant });
      await registry.heartbeat(id);
      return { success: true, id, timestamp: new Date().toISOString() };
    } catch (err) {
      const e = err as any;
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: { code: e.code ?? "HEARTBEAT_FAILED", message: e.message } });
    }
  });

  app.post("/:id/health", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { health, latencyMs } = req.body as any;
    const tenant = (req as any).tenant ?? {};

    if (!["HEALTHY", "DEGRADED", "UNHEALTHY", "UNKNOWN"].includes(health)) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: "Invalid health value" } });
    }

    try {
      await registry.getById(id, { tenant });
      await registry.updateHealth(id, health, latencyMs);
      return { success: true, id, health, latencyMs };
    } catch (err) {
      const e = err as any;
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: { code: e.code ?? "HEALTH_UPDATE_FAILED", message: e.message } });
    }
  });
}
