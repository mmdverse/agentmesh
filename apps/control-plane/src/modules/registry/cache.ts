import { getRedis, RedisCache } from "@agentmesh/redis-adapter";
import type { AgentCard } from "@agentmesh/a2a-protocol";
import type { AgentRecord } from "./types.js";

export class RegistryCache {
  private cache: RedisCache;
  private healthCache: RedisCache;

  constructor() {
    try {
      const redis = getRedis();
      this.cache = new RedisCache(redis, "agentmesh:agent:");
      this.healthCache = new RedisCache(redis, "agentmesh:health:");
    } catch {
      // Fallback to in-memory if Redis not available (Phase 0 dev)
      const mem = new Map<string, string>();
      const fakeRedis = {
        get: async (k: string) => mem.get(k) ?? null,
        set: async (k: string, v: string) => { mem.set(k, v); },
        setex: async (k: string, _ttl: number, v: string) => { mem.set(k, v); },
        del: async (k: string) => { mem.delete(k); },
        exists: async (k: string) => (mem.has(k) ? 1 : 0),
      } as any;
      this.cache = new RedisCache(fakeRedis, "agentmesh:agent:");
      this.healthCache = new RedisCache(fakeRedis, "agentmesh:health:");
      console.warn("[registry-cache] Redis not available, using in-memory fallback");
    }
  }

  // Agent record cache
  async getAgent(id: string): Promise<AgentRecord | null> {
    return this.cache.get<AgentRecord>(id);
  }

  async setAgent(agent: AgentRecord, ttlSeconds = 300): Promise<void> {
    await this.cache.set(agent.id, agent, ttlSeconds);
  }

  async delAgent(id: string): Promise<void> {
    await this.cache.del(id);
  }

  // Card cache
  async getCard(agentId: string): Promise<{ card: AgentCard; fetchedAt: string } | null> {
    return this.cache.get<{ card: AgentCard; fetchedAt: string }>(`${agentId}:card`);
  }

  async setCard(agentId: string, card: AgentCard, ttlSeconds = 300): Promise<void> {
    await this.cache.set(`${agentId}:card`, { card, fetchedAt: new Date().toISOString() }, ttlSeconds);
  }

  // Health cache
  async getHealth(agentId: string): Promise<{ health: string; lastSeenAt: string; latencyMs?: number } | null> {
    return this.healthCache.get(`${agentId}`);
  }

  async setHealth(agentId: string, health: string, latencyMs?: number): Promise<void> {
    await this.healthCache.set(agentId, { health, lastSeenAt: new Date().toISOString(), latencyMs }, 120);
  }

  // Discovery cache - capability filtering
  async getDiscoveryCache(key: string): Promise<AgentRecord[] | null> {
    return this.cache.get<AgentRecord[]>(`discovery:${key}`);
  }

  async setDiscoveryCache(key: string, agents: AgentRecord[], ttlSeconds = 60): Promise<void> {
    await this.cache.set(`discovery:${key}`, agents, ttlSeconds);
  }

  async invalidateDiscovery(): Promise<void> {
    // In Phase 1, we don't have scan, so we just log
    console.log("[registry-cache] discovery cache invalidation requested (Phase 1: no-op, will implement scan)");
  }
}

let cacheInstance: RegistryCache | null = null;

export function getRegistryCache(): RegistryCache {
  if (!cacheInstance) cacheInstance = new RegistryCache();
  return cacheInstance;
}
