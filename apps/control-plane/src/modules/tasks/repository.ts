import { getDb, schema } from "@agentmesh/postgres-adapter";
import { eq, and, desc, sql } from "drizzle-orm";
import type { TaskFilter, TaskRecord, TaskHistoryRecord } from "./types.js";
import type { TaskState } from "@agentmesh/core";

// In-memory fallback
class InMemoryTaskRepo {
  private tasks = new Map<string, TaskRecord>();
  private history = new Map<string, TaskHistoryRecord[]>();
  private edges = new Map<string, { parentTaskId: string; childTaskId: string; agentId: string; createdAt: string }[]>();

  async create(task: TaskRecord): Promise<TaskRecord> {
    this.tasks.set(task.id, task);
    this.history.set(task.id, [
      {
        id: `hist_${Date.now()}`,
        taskId: task.id,
        fromState: null,
        toState: task.state,
        reason: "Task created",
        createdAt: new Date().toISOString(),
      },
    ]);
    // Handle delegation edge
    if (task.parentTaskId) {
      const list = this.edges.get(task.parentTaskId) ?? [];
      list.push({ parentTaskId: task.parentTaskId, childTaskId: task.id, agentId: task.agentId, createdAt: new Date().toISOString() });
      this.edges.set(task.parentTaskId, list);
    }
    return task;
  }

  async getById(id: string): Promise<TaskRecord | null> {
    return this.tasks.get(id) ?? null;
  }

  async list(filter: TaskFilter): Promise<{ tasks: TaskRecord[]; total: number }> {
    let list = Array.from(this.tasks.values());

    if (filter.agentId) list = list.filter((t) => t.agentId === filter.agentId);
    if (filter.state) list = list.filter((t) => t.state === filter.state);
    if (filter.contextId) list = list.filter((t) => t.contextId === filter.contextId);
    if (filter.traceId) list = list.filter((t) => t.traceId === filter.traceId);
    if (filter.rootTaskId) list = list.filter((t) => t.rootTaskId === filter.rootTaskId);
    if (filter.organizationId) list = list.filter((t) => t.organizationId === filter.organizationId);
    if (filter.projectId) list = list.filter((t) => t.projectId === filter.projectId);

    const total = list.length;
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    list = list.slice(offset, offset + limit);

    return { tasks: list, total };
  }

  async update(id: string, updates: Partial<TaskRecord> & { fromState?: TaskRecord["state"] }): Promise<TaskRecord | null> {
    const existing = this.tasks.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: TaskRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: now,
    };

    this.tasks.set(id, updated);

    // Add history
    const hist = this.history.get(id) ?? [];
    hist.push({
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      taskId: id,
      fromState: updates.fromState ?? existing.state,
      toState: updated.state,
      reason: (updates as any).reason,
      createdAt: now,
    });
    this.history.set(id, hist);

    return updated;
  }

  async getHistory(taskId: string): Promise<TaskHistoryRecord[]> {
    return this.history.get(taskId) ?? [];
  }

  async getEdges(parentTaskId: string): Promise<Array<{ parentTaskId: string; childTaskId: string; agentId: string; createdAt: string }>> {
    return this.edges.get(parentTaskId) ?? [];
  }

  async getAllEdges(): Promise<Array<{ parentTaskId: string; childTaskId: string; agentId: string; createdAt: string }>> {
    const all: any[] = [];
    for (const list of this.edges.values()) all.push(...list);
    return all;
  }

  async getDelegationTree(rootTaskId: string): Promise<TaskRecord[]> {
    const visited = new Set<string>();
    const result: TaskRecord[] = [];

    const dfs = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);
      const task = this.tasks.get(taskId);
      if (!task) return;
      result.push(task);
      const children = this.edges.get(taskId) ?? [];
      for (const edge of children) dfs(edge.childTaskId);
    };

    dfs(rootTaskId);
    return result;
  }
}

const memRepo = new InMemoryTaskRepo();

export class TaskRepository {
  private useMemory: boolean;

  constructor() {
    this.useMemory = process.env.USE_POSTGRES !== "true";
    if (this.useMemory) console.log("[task-repo] Using InMemory repository (Phase 2 default)");
    else console.log("[task-repo] Using Postgres repository");
  }

  async create(task: TaskRecord): Promise<TaskRecord> {
    if (this.useMemory) return memRepo.create(task);

    const db = getDb();
    const [created] = await db
      .insert(schema.tasks)
      .values({
        id: task.id,
        rootTaskId: task.rootTaskId,
        parentTaskId: task.parentTaskId,
        agentId: task.agentId,
        sessionId: task.sessionId,
        contextId: task.contextId,
        traceId: task.traceId,
        organizationId: task.organizationId as any,
        projectId: task.projectId as any,
        state: task.state as any,
        input: task.input as any,
        output: task.output as any,
        error: task.error as any,
        metadata: task.metadata as any,
        attempts: task.attempts,
        maxAttempts: task.maxAttempts,
        expiresAt: task.expiresAt ? new Date(task.expiresAt) : undefined,
      })
      .returning();

    await db.insert(schema.taskHistory).values({
      taskId: task.id,
      fromState: null,
      toState: task.state as any,
      reason: "Task created",
    });

    if (task.parentTaskId) {
      await db.insert(schema.taskEdges).values({
        parentTaskId: task.parentTaskId,
        childTaskId: task.id,
        agentId: task.agentId,
      });
    }

    return this.mapToRecord(created);
  }

  async getById(id: string): Promise<TaskRecord | null> {
    if (this.useMemory) return memRepo.getById(id);

    const db = getDb();
    const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
    if (!task) return null;
    return this.mapToRecord(task);
  }

  async list(filter: TaskFilter): Promise<{ tasks: TaskRecord[]; total: number }> {
    if (this.useMemory) return memRepo.list(filter);

    const db = getDb();
    const conditions: any[] = [];
    if (filter.agentId) conditions.push(eq(schema.tasks.agentId, filter.agentId));
    if (filter.state) conditions.push(eq(schema.tasks.state, filter.state as any));
    if (filter.contextId) conditions.push(eq(schema.tasks.contextId, filter.contextId));
    if (filter.traceId) conditions.push(eq(schema.tasks.traceId, filter.traceId));
    if (filter.rootTaskId) conditions.push(eq(schema.tasks.rootTaskId, filter.rootTaskId));
    if (filter.organizationId) conditions.push(eq(schema.tasks.organizationId, filter.organizationId as any));

    let query = db.select().from(schema.tasks).$dynamic();
    if (conditions.length > 0) query = query.where(and(...conditions));

    const tasks = await query
      .orderBy(desc(schema.tasks.createdAt))
      .limit(filter.limit ?? 20)
      .offset(filter.offset ?? 0);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return { tasks: tasks.map(this.mapToRecord), total: Number(count) };
  }

  async update(id: string, updates: Partial<TaskRecord> & { fromState?: TaskRecord["state"]; reason?: string }): Promise<TaskRecord | null> {
    if (this.useMemory) return memRepo.update(id, updates);

    const db = getDb();
    const [existing] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
    if (!existing) return null;

    const [updated] = await db
      .update(schema.tasks)
      .set({
        state: (updates.state as any) ?? existing.state,
        output: (updates.output as any) ?? existing.output,
        error: (updates.error as any) ?? existing.error,
        metadata: (updates.metadata as any) ?? existing.metadata,
        attempts: updates.attempts ?? existing.attempts,
        updatedAt: new Date(),
        expiresAt: updates.expiresAt ? new Date(updates.expiresAt) : existing.expiresAt,
      })
      .where(eq(schema.tasks.id, id))
      .returning();

    await db.insert(schema.taskHistory).values({
      taskId: id,
      fromState: (updates.fromState as any) ?? (existing.state as any),
      toState: (updates.state as any) ?? (existing.state as any),
      reason: updates.reason,
    });

    return this.mapToRecord(updated);
  }

  async getHistory(taskId: string): Promise<TaskHistoryRecord[]> {
    if (this.useMemory) return memRepo.getHistory(taskId);

    const db = getDb();
    const rows = await db.select().from(schema.taskHistory).where(eq(schema.taskHistory.taskId, taskId)).orderBy(desc(schema.taskHistory.createdAt));
    return rows.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      fromState: r.fromState as any,
      toState: r.toState as any,
      reason: r.reason ?? undefined,
      actorId: r.actorId ?? undefined,
      metadata: (r.metadata as any) ?? undefined,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt as any),
    }));
  }

  async getDelegationTree(rootTaskId: string): Promise<TaskRecord[]> {
    if (this.useMemory) return memRepo.getDelegationTree(rootTaskId);

    // For Postgres, we need to recursively get edges - simplified for Phase 2
    const db = getDb();
    const visited = new Set<string>();
    const result: TaskRecord[] = [];

    const dfs = async (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);
      const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
      if (!task) return;
      result.push(this.mapToRecord(task));
      const edges = await db.select().from(schema.taskEdges).where(eq(schema.taskEdges.parentTaskId, taskId));
      for (const edge of edges) await dfs(edge.childTaskId);
    };

    await dfs(rootTaskId);
    return result;
  }

  private mapToRecord(row: any): TaskRecord {
    return {
      id: row.id,
      rootTaskId: row.rootTaskId,
      parentTaskId: row.parentTaskId,
      agentId: row.agentId,
      sessionId: row.sessionId,
      contextId: row.contextId,
      traceId: row.traceId,
      organizationId: row.organizationId,
      projectId: row.projectId,
      state: row.state,
      input: row.input,
      output: row.output,
      error: row.error,
      metadata: row.metadata ?? {},
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
      expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : row.expiresAt,
    };
  }
}

let repoInstance: TaskRepository | null = null;

export function getTaskRepository(): TaskRepository {
  if (!repoInstance) repoInstance = new TaskRepository();
  return repoInstance;
}
