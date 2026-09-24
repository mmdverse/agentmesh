import { getRegistryRepository } from "./repository.js";
import { getRegistryCache } from "./cache.js";
import { fetchCardFromUrl, fetchCardWithDiscovery } from "../../lib/agent-card-fetcher.js";
import { createEventBus, type AgentMeshEvent } from "@agentmesh/events";
import type { RegisterAgentInput, AgentFilter, AgentRecord } from "./types.js";
import { ValidationError, NotFoundError } from "@agentmesh/core";
import { AgentCardSchema } from "@agentmesh/a2a-protocol";

export class RegistryService {
  private repo = getRegistryRepository();
  private cache = getRegistryCache();
  private eventBus = createEventBus({ serviceName: "control-plane-registry" });

  async register(input: RegisterAgentInput): Promise<AgentRecord> {
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
        // If fetch fails, we still allow registration with provided name, but mark as UNTRUSTED
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

    // Event
    await this.publishEvent("agent.registered", record.id, { agent: record, fetchedFrom: fetchedUrl });

    return record;
  }

  async getById(id: string, opts: { useCache?: boolean; includeCard?: boolean } = {}): Promise<AgentRecord> {
    const useCache = opts.useCache ?? true;

    if (useCache) {
      const cached = await this.cache.getAgent(id);
      if (cached) {
        // Optionally refresh card from cache
        if (opts.includeCard) {
          const cardCached = await this.cache.getCard(id);
          if (cardCached) cached.card = cardCached.card;
        }
        return cached;
      }
    }

    const agent = await this.repo.getById(id);
    if (!agent) throw new NotFoundError("Agent", id);

    // Cache it
    await this.cache.setAgent(agent);

    // Try to get card if requested and not in record
    if (opts.includeCard && !agent.card) {
      try {
        const cardCached = await this.cache.getCard(id);
        if (cardCached) agent.card = cardCached.card;
        else {
          // Fetch fresh card from agent URL
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

  async list(filter: AgentFilter): Promise<{ agents: AgentRecord[]; total: number }> {
    // Try discovery cache for capability filtering
    const cacheKey = `${filter.skill ?? ""}:${filter.capability ?? ""}:${filter.region ?? ""}:${filter.search ?? ""}:${filter.limit ?? 20}:${filter.offset ?? 0}`;
    if (filter.skill || filter.capability) {
      const cached = await this.cache.getDiscoveryCache(cacheKey);
      if (cached) return { agents: cached, total: cached.length };
    }

    const result = await this.repo.list(filter);

    // Cache discovery results
    if (filter.skill || filter.capability) {
      await this.cache.setDiscoveryCache(cacheKey, result.agents);
    }

    return result;
  }

  async update(id: string, input: Partial<RegisterAgentInput>): Promise<AgentRecord> {
    const existing = await this.getById(id, { useCache: false });
    if (!existing) throw new NotFoundError("Agent", id);

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

    await this.publishEvent("agent.updated", id, { agent: updated });

    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.repo.getById(id);
    if (!existing) throw new NotFoundError("Agent", id);

    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError("Agent", id);

    await this.cache.delAgent(id);
    await this.cache.invalidateDiscovery();

    await this.publishEvent("agent.deleted", id, { agentId: id });
  }

  async getCard(id: string, opts: { forceRefresh?: boolean } = {}): Promise<{ card: any; fetchedAt: string; fromCache: boolean }> {
    const agent = await this.getById(id, { useCache: true });

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
      // If fetch fails, return cached if exists, otherwise throw
      const cached = await this.cache.getCard(id);
      if (cached) return { card: cached.card, fetchedAt: cached.fetchedAt, fromCache: true };
      throw new ValidationError(`Failed to fetch Agent Card from ${agent.url}: ${(err as Error).message}`);
    }
  }

  async updateHealth(id: string, health: "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN", latencyMs?: number): Promise<void> {
    await this.repo.updateHealth(id, health);
    await this.cache.setAgent({ ...(await this.getById(id, { useCache: false })), health } as any);
    // Don't use cache for health, set separately
    const cache = getRegistryCache();
    await cache.setAgent(await this.repo.getById(id) as any);
    // Also set health cache
    await (cache as any).setHealth?.(id, health, latencyMs);

    if (health === "UNHEALTHY") {
      await this.publishEvent("agent.unhealthy", id, { agentId: id, health, latencyMs });
    }
  }

  async heartbeat(id: string): Promise<void> {
    await this.repo.update(id, { lastSeenAt: new Date().toISOString() } as any);
    await this.updateHealth(id, "HEALTHY");
  }

  private async publishEvent(type: AgentMeshEvent["type"], subject: string, data: unknown): Promise<void> {
    try {
      const event: AgentMeshEvent = {
        id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        source: "control-plane",
        subject: `agent.${subject}`,
        data,
        timestamp: new Date().toISOString(),
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
