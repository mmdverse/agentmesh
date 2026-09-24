import type { AgentRecord } from "../registry/types.js";
import { getRegistryService } from "../registry/service.js";
import { fetchCardFromUrl } from "../../lib/agent-card-fetcher.js";

export interface DiscoveryProvider {
  readonly name: string;
  discover(query: DiscoveryQuery): Promise<AgentRecord[]>;
}

export interface DiscoveryQuery {
  skill?: string;
  capability?: string;
  region?: string;
  tags?: string[];
  limit?: number;
  search?: string;
}

// Local Registry Provider - uses our own registry
export class LocalRegistryProvider implements DiscoveryProvider {
  readonly name = "local_registry";

  async discover(query: DiscoveryQuery): Promise<AgentRecord[]> {
    const service = getRegistryService();
    const { agents } = await service.list({
      skill: query.skill,
      capability: query.capability,
      region: query.region,
      tags: query.tags,
      search: query.search,
      limit: query.limit ?? 20,
    });
    return agents;
  }
}

// Direct URL Provider - fetch card directly from URL
export class DirectUrlProvider implements DiscoveryProvider {
  readonly name = "direct_url";

  async discover(query: DiscoveryQuery & { url: string }): Promise<AgentRecord[]> {
    if (!query.url) return [];
    try {
      const result = await fetchCardFromUrl(query.url, { allowPrivate: true });
      // Convert card to AgentRecord-like (without persisting)
      const record: AgentRecord = {
        id: `temp_${Date.now()}`,
        name: result.card.name,
        description: result.card.description ?? null,
        version: result.card.version,
        url: result.card.url,
        providerOrganization: result.card.provider?.organization ?? null,
        trustLevel: "UNTRUSTED",
        health: "UNKNOWN",
        region: null,
        environment: "development",
        tags: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        ttlSeconds: null,
        skills: result.card.skills.map((s) => ({ skillId: s.id, name: s.name, description: s.description, tags: s.tags })),
        card: result.card,
      };
      return [record];
    } catch (err) {
      console.warn(`[discovery:direct] failed to fetch ${query.url}: ${(err as Error).message}`);
      return [];
    }
  }
}

// Well-Known Discovery Provider
export class WellKnownProvider implements DiscoveryProvider {
  readonly name = "well_known";

  async discover(query: DiscoveryQuery & { baseUrl: string }): Promise<AgentRecord[]> {
    if (!query.baseUrl) return [];
    const direct = new DirectUrlProvider();
    const wellKnownUrl = `${new URL(query.baseUrl).origin}/.well-known/agent.json`;
    return direct.discover({ ...query, url: wellKnownUrl });
  }
}

// Manually Configured Agents Provider
export class ManualProvider implements DiscoveryProvider {
  readonly name = "manual";
  private manualAgents: AgentRecord[] = [];

  addAgent(agent: AgentRecord): void {
    this.manualAgents.push(agent);
  }

  async discover(query: DiscoveryQuery): Promise<AgentRecord[]> {
    let list = this.manualAgents;
    if (query.skill) {
      list = list.filter((a) => a.skills?.some((s) => s.skillId === query.skill || s.name === query.skill));
    }
    if (query.region) {
      list = list.filter((a) => a.region === query.region);
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    return list.slice(0, query.limit ?? 20);
  }
}

// Composite Discovery - tries multiple providers
export class CompositeDiscovery {
  private providers: DiscoveryProvider[] = [];

  constructor() {
    this.providers.push(new LocalRegistryProvider());
    this.providers.push(new ManualProvider());
  }

  registerProvider(provider: DiscoveryProvider): void {
    this.providers.push(provider);
  }

  async discover(query: DiscoveryQuery & { url?: string; baseUrl?: string }): Promise<AgentRecord[]> {
    const results: AgentRecord[] = [];
    const seen = new Set<string>();

    for (const provider of this.providers) {
      try {
        const agents = await provider.discover(query as any);
        for (const agent of agents) {
          if (!seen.has(agent.id) && !seen.has(agent.url)) {
            seen.add(agent.id);
            seen.add(agent.url);
            results.push(agent);
          }
        }
        if (results.length >= (query.limit ?? 20)) break;
      } catch (err) {
        console.warn(`[discovery] provider ${provider.name} failed: ${(err as Error).message}`);
      }
    }

    // If direct URL provided, also try it
    if (query.url) {
      const direct = new DirectUrlProvider();
      const directResults = await direct.discover(query as any);
      for (const agent of directResults) {
        if (!seen.has(agent.url)) {
          results.push(agent);
        }
      }
    }

    return results.slice(0, query.limit ?? 20);
  }
}

let discoveryInstance: CompositeDiscovery | null = null;

export function getDiscovery(): CompositeDiscovery {
  if (!discoveryInstance) discoveryInstance = new CompositeDiscovery();
  return discoveryInstance;
}
