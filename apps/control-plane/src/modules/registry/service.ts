import { getRegistryRepository } from "./repository.js";
import { getRegistryCache } from "./cache.js";
import { fetchCardFromUrl, fetchCardWithDiscovery } from "../../lib/agent-card-fetcher.js";
import { createEventBus, type AgentMeshEvent } from "@agentmesh/events";
import type { RegisterAgentInput, AgentFilter, AgentRecord } from "./types.js";
import { ValidationError, NotFoundError, AuthorizationError } from "@agentmesh/core";
import { AgentCardSchema } from "@agentmesh/a2a-protocol";
import { getVersionResolver, type VersionConstraint, compareSemVer, isStableVersion, satisfiesRange } from "@agentmesh/versioning";
import { getTenantManager, type TenantContext } from "@agentmesh/tenancy";
import { DEFAULT_RESOURCE_LIMITS, checkResourceLimits } from "@agentmesh/rate-limit";
import { getRegistryService as _unused } from "./service.js"; // placeholder to keep import graph

export class RegistryService {
  private repo = getRegistryRepository();
  private cache = getRegistryCache();
  private eventBus = createEventBus({ serviceName: "control-plane-registry", url: process.env.NATS_URL });
  private versionResolver = getVersionResolver();
  private tenantManager = getTenantManager();

  async register(input: RegisterAgentInput & { tenant?: TenantContext }): Promise<AgentRecord> {
    // Resource limits check - message size etc is handled at gateway, but validate metadata size
    const metadataSize = JSON.stringify(input.metadata ?? {}).length;
    const resourceCheck = checkResourceLimits(DEFAULT_RESOURCE_LIMITS, { messageSize: metadataSize });
    if (!resourceCheck.allowed) {
      throw new ValidationError(resourceCheck.reason ?? "Resource limit exceeded");
    }

    // Tenant validation
    if (input.tenant) {
      this.tenantManager.validateContext(input.tenant);
      // Enforce that organizationId/projectId in input matches tenant context if provided
      if (input.tenant.organizationId && input.organizationId && input.tenant.organizationId !== input.organizationId) {
        throw new AuthorizationError("Organization mismatch between tenant context and input");
      }
      if (input.tenant.projectId && input.projectId && input.tenant.projectId !== input.projectId) {
        throw new AuthorizationError("Project mismatch between tenant context and input");
      }
      // Use tenant context as default if input doesn't have it
      input.organizationId = input.organizationId ?? input.tenant.organizationId;
      input.projectId = input.projectId ?? input.tenant.projectId;
    }

    // Validate URL
    if (!input.url) throw new ValidationError("Agent URL is required");
    try {
      new URL(input.url);
    } catch {
      throw new ValidationError(`Invalid URL: ${input.url}`);
    }

    let card = input.card;
    let fetchedUrl = input.url;

    // Fetch card if requested or not provided
    if (input.fetchCard !== false && !card) {
      try {
        const result = await fetchCardWithDiscovery(input.url, { allowPrivate: true });
        card = result.card;
        fetchedUrl = result.url;
        console.log(`[registry] fetched card from ${fetchedUrl} for ${card.name}`);
      } catch (err) {
        console.warn(`[registry] failed to fetch card from ${input.url}: ${(err as Error).message}, proceeding with manual registration`);
      }
    }

    // If card provided, validate it
    if (card) {
      const parsed = AgentCardSchema.safeParse(card);
      if (!parsed.success) {
        throw new ValidationError(`Invalid Agent Card: ${parsed.error.message}`, parsed.error.flatten());
      }
      card = parsed.data;
    }

    // Determine name/version from card if not provided
    const name = input.name ?? card?.name ?? new URL(input.url).hostname;
    const version = input.version ?? card?.version ?? "0.1.0";
    const description = input.description ?? card?.description;

    // Versioning: validate semver format (warn if not)
    const isValidSemver = /^v?\d+\.\d+\.\d+/.test(version);
    if (!isValidSemver) {
      console.warn(`[registry] version ${version} for ${name} is not semver, but allowing`);
    }

    const record = await this.repo.create({
      ...input,
      name,
      version,
      description,
      card,
    });

    // Cache
    await this.cache.setAgent(record);
    if (card) await this.cache.setCard(record.id, card);
    await this.cache.invalidateDiscovery();

    // Event with tenant context
    await this.publishEvent("agent.registered", record.id, { agent: record, fetchedFrom: fetchedUrl }, input.tenant);

    return record;
  }

  async getById(id: string, opts: { useCache?: boolean; includeCard?: boolean; tenant?: TenantContext } = {}): Promise<AgentRecord> {
    const useCache = opts.useCache ?? true;

    let agent: AgentRecord | null = null;

    if (useCache) {
      const cached = await this.cache.getAgent(id);
      if (cached) {
        agent = cached;
        if (opts.includeCard) {
          const cardCached = await this.cache.getCard(id);
          if (cardCached) agent.card = cardCached.card;
        }
      }
    }

    if (!agent) {
      const fromDb = await this.repo.getById(id);
      if (!fromDb) throw new NotFoundError("Agent", id);
      agent = fromDb;
      await this.cache.setAgent(agent);
    }

    // Tenant isolation check
    if (opts.tenant && (agent.organizationId || agent.projectId)) {
      const resourceTenant: TenantContext = {
        organizationId: agent.organizationId ?? undefined,
        projectId: agent.projectId ?? undefined,
      };
      this.tenantManager.enforce(opts.tenant, resourceTenant);
    }

    // Try to get card if requested and not in record
    if (opts.includeCard && !agent.card) {
      try {
        const cardCached = await this.cache.getCard(id);
        if (cardCached) agent.card = cardCached.card;
        else {
          const result = await fetchCardFromUrl(agent.url, { allowPrivate: true });
          agent.card = result.card;
          await this.cache.setCard(id, result.card);
        }
      } catch (err) {
        console.warn(`[registry] failed to fetch card for ${id}: ${(err as Error).message}`);
      }
    }

    return agent;
  }

  async list(filter: AgentFilter & { tenant?: TenantContext; versionConstraint?: VersionConstraint }): Promise<{ agents: AgentRecord[]; total: number }> {
    // Enforce tenant isolation - if tenant provided, filter by it
    if (filter.tenant) {
      // Merge tenant filter into agent filter
      if (filter.tenant.organizationId) {
        if (filter.organizationId && filter.organizationId !== filter.tenant.organizationId) {
          throw new AuthorizationError("Organization mismatch in list filter");
        }
        filter.organizationId = filter.tenant.organizationId;
      }
      if (filter.tenant.projectId) {
        if (filter.projectId && filter.projectId !== filter.tenant.projectId) {
          throw new AuthorizationError("Project mismatch in list filter");
        }
        filter.projectId = filter.tenant.projectId;
      }
    }

    // Version filtering logic
    let result: { agents: AgentRecord[]; total: number };

    // If version constraint is specific, we can optimize via repo
    if (filter.versionConstraint) {
      // Get all matching name first, then resolve version
      const all = await this.repo.list({
        ...filter,
        version: undefined, // we handle version ourselves for complex constraints
      });

      // If filtering by name, resolve versions per name group
      if (filter.name) {
        const resolved = this.versionResolver.resolveAll(
          all.agents.map((a) => ({ id: a.id, name: a.name, version: a.version, createdAt: a.createdAt })),
          filter.versionConstraint
        );
        const resolvedIds = new Set(resolved.map((r) => r.id));
        const agents = all.agents.filter((a) => resolvedIds.has(a.id));
        result = { agents, total: agents.length };
      } else {
        // For general list, apply version constraint as filter
        const agents = all.agents.filter((a) => {
          if (filter.versionConstraint?.strategy === "specific" && filter.versionConstraint.version) {
            return a.version === filter.versionConstraint.version;
          }
          if (filter.versionConstraint?.strategy === "minimum" && filter.versionConstraint.version) {
            return compareSemVer(a.version, filter.versionConstraint.version) >= 0;
          }
          if (filter.versionConstraint?.strategy === "stable") {
            return isStableVersion(a.version);
          }
          if (filter.versionConstraint?.range) {
            return satisfiesRange(a.version, filter.versionConstraint.range);
          }
          return true;
        });
        result = { agents, total: agents.length };
      }
    } else {
      // Try discovery cache for capability filtering
      const cacheKey = `${filter.skill ?? ""}:${filter.capability ?? ""}:${filter.region ?? ""}:${filter.search ?? ""}:${filter.limit ?? 20}:${filter.offset ?? 0}:${filter.organizationId ?? ""}:${filter.projectId ?? ""}:${filter.version ?? ""}`;
      if (filter.skill || filter.capability) {
        const cached = await this.cache.getDiscoveryCache(cacheKey);
        if (cached) return { agents: cached, total: cached.length };
      }

      result = await this.repo.list(filter);

      // Cache discovery results
      if (filter.skill || filter.capability) {
        await this.cache.setDiscoveryCache(cacheKey, result.agents);
      }
    }

    // Additional version filtering if filter.version is simple string
    if (filter.version && !filter.versionConstraint) {
      result.agents = result.agents.filter((a) => a.version === filter.version);
      result.total = result.agents.length;
    }

    return result;
  }

  // Version-aware discovery: find best agent matching skill and version constraint
  async discoverBest(
    skill: string,
    constraint?: VersionConstraint,
    tenant?: TenantContext
  ): Promise<AgentRecord | null> {
    const filter: AgentFilter & { tenant?: TenantContext; versionConstraint?: VersionConstraint } = {
      skill,
      tenant,
      versionConstraint: constraint,
    };

    const { agents } = await this.list(filter);
    if (agents.length === 0) return null;

    if (constraint) {
      const resolved = this.versionResolver.resolve(
        agents.map((a) => ({ id: a.id, name: a.name, version: a.version, createdAt: a.createdAt })),
        constraint
      );
      if (!resolved) return null;
      return agents.find((a) => a.id === resolved.id) ?? null;
    }

    // Default: latest stable
    const stable = agents.filter((a) => isStableVersion(a.version));
    const candidates = stable.length > 0 ? stable : agents;
    const latest = candidates.reduce((prev, curr) => (compareSemVer(curr.version, prev.version) > 0 ? curr : prev));
    return latest;
  }

  // List versions for a given agent name
  async listVersions(
    name: string,
    tenant?: TenantContext
  ): Promise<{ versions: string[]; agents: AgentRecord[] }> {
    const filter: AgentFilter & { tenant?: TenantContext } = { name, tenant, limit: 100 };
    const { agents } = await this.list(filter);
    const versions = [...new Set(agents.map((a) => a.version))].sort((a, b) => compareSemVer(b, a));
    return { versions, agents };
  }

  async update(id: string, input: Partial<RegisterAgentInput> & { tenant?: TenantContext }): Promise<AgentRecord> {
    const existing = await this.getById(id, { useCache: false, tenant: input.tenant });
    if (!existing) throw new NotFoundError("Agent", id);

    // Tenant isolation on update
    if (input.tenant) {
      const resourceTenant: TenantContext = {
        organizationId: existing.organizationId ?? undefined,
        projectId: existing.projectId ?? undefined,
      };
      this.tenantManager.enforce(input.tenant, resourceTenant);
    }

    // If URL changed and fetchCard true, fetch new card
    let card = existing.card;
    if (input.url && input.url !== existing.url && input.fetchCard !== false) {
      try {
        const result = await fetchCardWithDiscovery(input.url, { allowPrivate: true });
        card = result.card;
        await this.cache.setCard(id, card);
      } catch (err) {
        console.warn(`[registry] failed to fetch new card for ${id}: ${(err as Error).message}`);
      }
    }

    if (input.card) {
      const parsed = AgentCardSchema.safeParse(input.card);
      if (!parsed.success) throw new ValidationError(`Invalid Agent Card: ${parsed.error.message}`);
      card = parsed.data;
    }

    const updated = await this.repo.update(id, { ...input, ...(card ? { card } : {}) } as any);
    if (!updated) throw new NotFoundError("Agent", id);

    // Update cache
    await this.cache.setAgent(updated);
    if (card) await this.cache.setCard(id, card);
    await this.cache.invalidateDiscovery();

    await this.publishEvent("agent.updated", id, { agent: updated }, input.tenant);

    return updated;
  }

  async delete(id: string, tenant?: TenantContext): Promise<void> {
    const existing = await this.repo.getById(id);
    if (!existing) throw new NotFoundError("Agent", id);

    if (tenant) {
      const resourceTenant: TenantContext = {
        organizationId: existing.organizationId ?? undefined,
        projectId: existing.projectId ?? undefined,
      };
      this.tenantManager.enforce(tenant, resourceTenant);
    }

    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError("Agent", id);

    await this.cache.delAgent(id);
    await this.cache.invalidateDiscovery();

    await this.publishEvent("agent.deleted", id, { agentId: id }, tenant);
  }

  async getCard(id: string, opts: { forceRefresh?: boolean; tenant?: TenantContext } = {}): Promise<{ card: any; fetchedAt: string; fromCache: boolean }> {
    const agent = await this.getById(id, { useCache: true, tenant: opts.tenant });

    if (!opts.forceRefresh) {
      const cached = await this.cache.getCard(id);
      if (cached) return { card: cached.card, fetchedAt: cached.fetchedAt, fromCache: true };
    }

    // Fetch fresh
    try {
      const result = await fetchCardFromUrl(agent.url, { allowPrivate: true });
      await this.cache.setCard(id, result.card);
      await this.repo.update(id, { lastSeenAt: new Date().toISOString() } as any);
      return { card: result.card, fetchedAt: result.fetchedAt, fromCache: false };
    } catch (err) {
      const cached = await this.cache.getCard(id);
      if (cached) return { card: cached.card, fetchedAt: cached.fetchedAt, fromCache: true };
      throw new ValidationError(`Failed to fetch Agent Card from ${agent.url}: ${(err as Error).message}`);
    }
  }

  async updateHealth(id: string, health: "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN", latencyMs?: number): Promise<void> {
    await this.repo.updateHealth(id, health);
    await this.cache.setAgent({ ...(await this.getById(id, { useCache: false })), health } as any);
    const cache = getRegistryCache();
    await cache.setAgent((await this.repo.getById(id)) as any);
    await (cache as any).setHealth?.(id, health, latencyMs);

    if (health === "UNHEALTHY") {
      await this.publishEvent("agent.unhealthy", id, { agentId: id, health, latencyMs });
    }
  }

  async heartbeat(id: string): Promise<void> {
    await this.repo.update(id, { lastSeenAt: new Date().toISOString() } as any);
    await this.updateHealth(id, "HEALTHY");
  }

  private async publishEvent(type: AgentMeshEvent["type"], subject: string, data: unknown, tenant?: TenantContext): Promise<void> {
    try {
      const event: AgentMeshEvent = {
        id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        source: "control-plane",
        subject: `agent.${subject}`,
        data,
        timestamp: new Date().toISOString(),
        organizationId: tenant?.organizationId,
        projectId: tenant?.projectId,
      };
      await this.eventBus.publish(event);
    } catch (err) {
      console.warn(`[registry] failed to publish event ${type}: ${(err as Error).message}`);
    }
  }
}

let serviceInstance: RegistryService | null = null;

export function getRegistryService(): RegistryService {
  if (!serviceInstance) serviceInstance = new RegistryService();
  return serviceInstance;
}
