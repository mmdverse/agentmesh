import { getRedis, RedisCache } from "@agentmesh/redis-adapter";

export type AgentRecord = any;

// For Phase 1, gateway reads from same Redis cache as control-plane, plus fallback to control-plane HTTP
export interface RegistryClientConfig {
  controlPlaneUrl?: string;
  redisUrl?: string;
  cacheTtlSeconds?: number;
}

export class RegistryClient {
  private cache: RedisCache;
  private controlPlaneUrl: string;
  private cacheTtl: number;

  constructor(config: RegistryClientConfig = {}) {
    this.controlPlaneUrl = config.controlPlaneUrl ?? process.env.CONTROL_PLANE_URL ?? "http://localhost:3002";
    this.cacheTtl = config.cacheTtlSeconds ?? 60;

    try {
      const redis = getRedis();
      this.cache = new RedisCache(redis, "agentmesh:agent:");
    } catch {
      const mem = new Map<string, string>();
      const fakeRedis = {
        get: async (k: string) => mem.get(k) ?? null,
        set: async (k: string, v: string) => { mem.set(k, v); },
        setex: async (k: string, _ttl: number, v: string) => { mem.set(k, v); },
        del: async (k: string) => { mem.delete(k); },
        exists: async (k: string) => (mem.has(k) ? 1 : 0),
      } as any;
      this.cache = new RedisCache(fakeRedis, "agentmesh:agent:");
      console.warn("[registry-client] Redis not available, using in-memory");
    }
  }

  async getAgent(id: string): Promise<AgentRecord | null> {
    // Try cache first
    const cached = await this.cache.get<AgentRecord>(id);
    if (cached) return cached as any;

    // Try control-plane HTTP
    try {
      const res = await fetch(`${this.controlPlaneUrl}/v1/agents/${id}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = (await res.json()) as any;
        const agent = data.agent;
        if (agent) {
          await this.cache.set(id, agent, this.cacheTtl);
          return agent;
        }
      }
    } catch (err) {
      console.warn(`[registry-client] failed to fetch agent ${id} from control-plane: ${(err as Error).message}`);
    }

    return null;
  }

  async listAgents(filter: { skill?: string; capability?: string; region?: string; limit?: number } = {}): Promise<AgentRecord[]> {
    const params = new URLSearchParams();
    if (filter.skill) params.set("skill", filter.skill);
    if (filter.capability) params.set("capability", filter.capability);
    if (filter.region) params.set("region", filter.region);
    if (filter.limit) params.set("limit", String(filter.limit));

    try {
      const res = await fetch(`${this.controlPlaneUrl}/v1/agents?${params.toString()}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = (await res.json()) as any;
        return data.agents ?? [];
      }
    } catch (err) {
      console.warn(`[registry-client] failed to list agents: ${(err as Error).message}`);
    }

    return [];
  }

  async discover(filter: { skill?: string; capability?: string; region?: string; search?: string; limit?: number }): Promise<AgentRecord[]> {
    const params = new URLSearchParams();
    if (filter.skill) params.set("skill", filter.skill);
    if (filter.capability) params.set("capability", filter.capability);
    if (filter.region) params.set("region", filter.region);
    if (filter.search) params.set("search", filter.search);
    if (filter.limit) params.set("limit", String(filter.limit));

    try {
      const res = await fetch(`${this.controlPlaneUrl}/v1/agents/discover?${params.toString()}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = (await res.json()) as any;
        return data.agents ?? [];
      }
    } catch (err) {
      console.warn(`[registry-client] discover failed: ${(err as Error).message}`);
    }

    return [];
  }
}

let clientInstance: RegistryClient | null = null;

export function getRegistryClient(): RegistryClient {
  if (!clientInstance) clientInstance = new RegistryClient();
  return clientInstance;
}
