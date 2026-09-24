import { getDb, schema } from "@agentmesh/postgres-adapter";
import { eq, and, ilike, or, desc, asc, sql, inArray } from "drizzle-orm";
import type { AgentFilter, RegisterAgentInput, AgentRecord } from "./types.js";
import type { AgentCard } from "@agentmesh/a2a-protocol";

// In-memory fallback for Phase 0/1 when Postgres not available
class InMemoryRepo {
  private agents = new Map<string, AgentRecord>();
  private skills = new Map<string, Array<{ skillId: string; name: string; description?: string; tags: string[] }>>();

  async create(input: RegisterAgentInput & { card?: AgentCard }): Promise<AgentRecord> {
    const id = `agent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const record: AgentRecord = {
      id,
      organizationId: input.organizationId ?? null,
      projectId: input.projectId ?? null,
      name: input.name ?? input.card?.name ?? "Unknown Agent",
      description: input.description ?? input.card?.description ?? null,
      version: input.version ?? input.card?.version ?? "0.1.0",
      url: input.url,
      providerOrganization: input.providerOrganization ?? input.card?.provider?.organization ?? null,
      trustLevel: input.trustLevel ?? "UNTRUSTED",
      health: "UNKNOWN",
      region: input.region ?? null,
      environment: input.environment ?? "development",
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      ttlSeconds: input.ttlSeconds ?? null,
      card: input.card ?? null,
    };
    this.agents.set(id, record);
    if (input.card?.skills) {
      this.skills.set(
        id,
        input.card.skills.map((s) => ({ skillId: s.id, name: s.name, description: s.description, tags: s.tags }))
      );
    }
    return record;
  }

  async getById(id: string): Promise<AgentRecord | null> {
    const agent = this.agents.get(id) ?? null;
    if (!agent) return null;
    return { ...agent, skills: this.skills.get(id) ?? [] };
  }

  async list(filter: AgentFilter): Promise<{ agents: AgentRecord[]; total: number }> {
    let list = Array.from(this.agents.values());

    if (filter.name) {
      list = list.filter((a) => a.name.toLowerCase().includes(filter.name!.toLowerCase()));
    }
    if (filter.region) {
      list = list.filter((a) => a.region === filter.region);
    }
    if (filter.health) {
      list = list.filter((a) => a.health === filter.health);
    }
    if (filter.trustLevel) {
      list = list.filter((a) => a.trustLevel === filter.trustLevel);
    }
    if (filter.skill) {
      list = list.filter((a) => {
        const skills = this.skills.get(a.id) ?? [];
        return skills.some((s) => s.skillId === filter.skill || s.name === filter.skill);
      });
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q));
    }

    const total = list.length;
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    list = list.slice(offset, offset + limit);

    const enriched = list.map((a) => ({ ...a, skills: this.skills.get(a.id) ?? [] }));
    return { agents: enriched, total };
  }

  async update(id: string, input: Partial<RegisterAgentInput> & { health?: string; lastSeenAt?: string }): Promise<AgentRecord | null> {
    const existing = this.agents.get(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const updated: AgentRecord = {
      ...existing,
      ...input,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      version: input.version ?? existing.version,
      url: input.url ?? existing.url,
      trustLevel: input.trustLevel ?? existing.trustLevel,
      health: input.health ?? existing.health,
      region: input.region ?? existing.region,
      environment: input.environment ?? existing.environment,
      tags: input.tags ?? existing.tags,
      metadata: input.metadata ?? existing.metadata,
      updatedAt: now,
      lastSeenAt: input.lastSeenAt ?? existing.lastSeenAt,
    };
    this.agents.set(id, updated);
    return { ...updated, skills: this.skills.get(id) ?? [] };
  }

  async delete(id: string): Promise<boolean> {
    const existed = this.agents.has(id);
    this.agents.delete(id);
    this.skills.delete(id);
    return existed;
  }

  async updateHealth(id: string, health: string): Promise<void> {
    const existing = this.agents.get(id);
    if (existing) {
      existing.health = health;
      existing.lastSeenAt = new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      this.agents.set(id, existing);
    }
  }
}

const memRepo = new InMemoryRepo();

export class RegistryRepository {
  private useMemory: boolean;

  constructor() {
    // Check if DATABASE_URL is set and we can connect
    // For Phase 1, we default to memory if no DB, but try Postgres
    this.useMemory = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("localhost") ? true : false;
    // Actually we will try to use memory for now to keep Phase 1 simple and not require DB running in CI
    // In production, set USE_POSTGRES=true to force Postgres
    if (process.env.USE_POSTGRES === "true") this.useMemory = false;
    else this.useMemory = true; // Phase 1: default to memory for simplicity, Postgres will be used in Phase 2 when we have migrations running

    if (this.useMemory) {
      console.log("[registry-repo] Using InMemory repository (Phase 1 default, set USE_POSTGRES=true to use Postgres)");
    } else {
      console.log("[registry-repo] Using Postgres repository");
    }
  }

  async create(input: RegisterAgentInput & { card?: AgentCard }): Promise<AgentRecord> {
    if (this.useMemory) return memRepo.create(input);

    const db = getDb();
    const now = new Date();

    // Create agent
    const [agent] = await db
      .insert(schema.agents)
      .values({
        organizationId: input.organizationId as any,
        projectId: input.projectId as any,
        name: input.name ?? input.card?.name ?? "Unknown",
        description: input.description ?? input.card?.description,
        version: input.version ?? input.card?.version ?? "0.1.0",
        url: input.url,
        providerOrganization: input.providerOrganization ?? input.card?.provider?.organization,
        trustLevel: input.trustLevel ?? "UNTRUSTED",
        health: "UNKNOWN",
        region: input.region,
        environment: input.environment ?? "development",
        tags: input.tags ?? [],
        metadata: input.metadata ?? {},
        ttlSeconds: input.ttlSeconds,
      })
      .returning();

    // Create skills if card has them
    if (input.card?.skills?.length) {
      await db.insert(schema.skills).values(
        input.card.skills.map((s) => ({
          agentId: agent.id,
          skillId: s.id,
          name: s.name,
          description: s.description,
          tags: s.tags,
          metadata: {},
        }))
      );
    }

    // Create agent card
    if (input.card) {
      await db.insert(schema.agentCards).values({
        agentId: agent.id,
        card: input.card as any,
        protocolVersion: input.card.protocolVersions?.[0] ?? "0.2",
      });
    }

    return this.mapToRecord(agent, input.card);
  }

  async getById(id: string): Promise<AgentRecord | null> {
    if (this.useMemory) return memRepo.getById(id);

    const db = getDb();
    const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, id as any)).limit(1);
    if (!agent) return null;

    const skills = await db.select().from(schema.skills).where(eq(schema.skills.agentId, agent.id));
    const [cardRow] = await db
      .select()
      .from(schema.agentCards)
      .where(eq(schema.agentCards.agentId, agent.id))
      .orderBy(desc(schema.agentCards.createdAt))
      .limit(1);

    return this.mapToRecord(agent, cardRow?.card as any, skills as any);
  }

  async list(filter: AgentFilter): Promise<{ agents: AgentRecord[]; total: number }> {
    if (this.useMemory) return memRepo.list(filter);

    const db = getDb();
    // For simplicity, we do basic filtering in Phase 1
    // Full capability filtering with joins will be in Phase 2
    let query = db.select().from(schema.agents).$dynamic();
    const conditions: any[] = [];

    if (filter.name) conditions.push(ilike(schema.agents.name, `%${filter.name}%`));
    if (filter.region) conditions.push(eq(schema.agents.region, filter.region));
    if (filter.health) conditions.push(eq(schema.agents.health, filter.health));
    if (filter.trustLevel) conditions.push(eq(schema.agents.trustLevel, filter.trustLevel));
    if (filter.organizationId) conditions.push(eq(schema.agents.organizationId, filter.organizationId as any));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const agents = await query.limit(filter.limit ?? 20).offset(filter.offset ?? 0);
    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.agents)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const enriched = await Promise.all(
      agents.map(async (a) => {
        const skills = await db.select().from(schema.skills).where(eq(schema.skills.agentId, a.id));
        return this.mapToRecord(a, null, skills as any);
      })
    );

    // Skill filtering post-query for Phase 1 (will be optimized in Phase 2)
    let filtered = enriched;
    if (filter.skill) {
      filtered = filtered.filter((a) => a.skills?.some((s) => s.skillId === filter.skill || s.name === filter.skill));
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      filtered = filtered.filter((a) => a.name.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q));
    }

    return { agents: filtered, total: Number(count) };
  }

  async update(id: string, input: Partial<RegisterAgentInput> & { health?: string; lastSeenAt?: string }): Promise<AgentRecord | null> {
    if (this.useMemory) return memRepo.update(id, input);

    const db = getDb();
    const [existing] = await db.select().from(schema.agents).where(eq(schema.agents.id, id as any)).limit(1);
    if (!existing) return null;

    const [updated] = await db
      .update(schema.agents)
      .set({
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        version: input.version ?? existing.version,
        url: input.url ?? existing.url,
        trustLevel: input.trustLevel ?? existing.trustLevel,
        health: (input.health as any) ?? existing.health,
        region: input.region ?? existing.region,
        environment: (input.environment as any) ?? existing.environment,
        tags: input.tags ?? (existing.tags as any),
        metadata: input.metadata ?? (existing.metadata as any),
        updatedAt: new Date(),
        lastSeenAt: input.lastSeenAt ? new Date(input.lastSeenAt) : existing.lastSeenAt,
      })
      .where(eq(schema.agents.id, id as any))
      .returning();

    const skills = await db.select().from(schema.skills).where(eq(schema.skills.agentId, updated.id));
    return this.mapToRecord(updated, null, skills as any);
  }

  async delete(id: string): Promise<boolean> {
    if (this.useMemory) return memRepo.delete(id);

    const db = getDb();
    const result = await db.delete(schema.agents).where(eq(schema.agents.id, id as any)).returning({ id: schema.agents.id });
    return result.length > 0;
  }

  async updateHealth(id: string, health: string): Promise<void> {
    if (this.useMemory) return memRepo.updateHealth(id, health);

    const db = getDb();
    await db
      .update(schema.agents)
      .set({ health: health as any, lastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.agents.id, id as any));
  }

  private mapToRecord(agent: any, card?: AgentCard | null, skills?: any[]): AgentRecord {
    return {
      id: agent.id,
      organizationId: agent.organizationId,
      projectId: agent.projectId,
      name: agent.name,
      description: agent.description,
      version: agent.version,
      url: agent.url,
      providerOrganization: agent.providerOrganization,
      trustLevel: agent.trustLevel,
      health: agent.health,
      region: agent.region,
      environment: agent.environment,
      tags: (agent.tags as string[]) ?? [],
      metadata: (agent.metadata as Record<string, unknown>) ?? {},
      createdAt: agent.createdAt instanceof Date ? agent.createdAt.toISOString() : agent.createdAt,
      updatedAt: agent.updatedAt instanceof Date ? agent.updatedAt.toISOString() : agent.updatedAt,
      lastSeenAt: agent.lastSeenAt instanceof Date ? agent.lastSeenAt.toISOString() : agent.lastSeenAt,
      ttlSeconds: agent.ttlSeconds,
      skills: skills?.map((s) => ({ skillId: s.skillId, name: s.name, description: s.description, tags: s.tags as string[] })) ?? [],
      card: card ?? null,
    };
  }
}

let repoInstance: RegistryRepository | null = null;

export function getRegistryRepository(): RegistryRepository {
  if (!repoInstance) repoInstance = new RegistryRepository();
  return repoInstance;
}
