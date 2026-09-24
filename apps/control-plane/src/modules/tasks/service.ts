import { getTaskRepository } from "./repository.js";
import { getRegistryService } from "../registry/service.js";
import { createEventBus, type AgentMeshEvent } from "@agentmesh/events";
import type { CreateTaskInput, TaskRecord, TaskFilter } from "./types.js";
import { TaskState, generateId, nowIso, canTransition, NotFoundError, ValidationError } from "@agentmesh/core";
import { TaskStateMachine } from "@agentmesh/tasks";

export class TaskService {
  private repo = getTaskRepository();
  private registry = getRegistryService();
  private eventBus = createEventBus({ serviceName: "control-plane-tasks" });

  async create(input: CreateTaskInput): Promise<TaskRecord> {
    // Validate agent exists
    let agent;
    try {
      agent = await this.registry.getById(input.agentId);
    } catch {
      throw new NotFoundError("Agent", input.agentId);
    }

    if (agent.health === "UNHEALTHY") {
      console.warn(`[tasks] creating task for unhealthy agent ${input.agentId}, but allowing (Phase 2)`);
    }

    const id = generateId("task");
    const sessionId = input.sessionId ?? generateId("sess");
    const contextId = input.contextId ?? generateId("ctx");
    const traceId = input.traceId ?? generateId("trace");
    const rootTaskId = input.parentTaskId ? (await this.repo.getById(input.parentTaskId))?.rootTaskId ?? input.parentTaskId : id;

    const now = nowIso();

    const task: TaskRecord = {
      id,
      rootTaskId,
      parentTaskId: input.parentTaskId ?? null,
      agentId: input.agentId,
      sessionId,
      contextId,
      traceId,
      organizationId: input.organizationId ?? null,
      projectId: input.projectId ?? null,
      state: TaskState.SUBMITTED,
      input: { message: input.message, metadata: input.metadata },
      output: null,
      error: null,
      metadata: input.metadata ?? {},
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
      expiresAt: null,
    };

    const created = await this.repo.create(task);

    await this.publishEvent("task.created", id, { task: created, agentId: input.agentId });

    // Transition to WORKING asynchronously (simulate delegation)
    setImmediate(async () => {
      try {
        await this.transition(id, TaskState.WORKING, { reason: "Task delegated to agent" });
        // In Phase 2, we simulate task execution - in Phase 3+ we will actually call agent via A2A
        // For now, we keep it WORKING until agent reports completion via API or timeout
      } catch (err) {
        console.error(`[tasks] failed to transition task ${id} to WORKING: ${(err as Error).message}`);
      }
    });

    return created;
  }

  async getById(id: string): Promise<TaskRecord> {
    const task = await this.repo.getById(id);
    if (!task) throw new NotFoundError("Task", id);
    return task;
  }

  async list(filter: TaskFilter): Promise<{ tasks: TaskRecord[]; total: number }> {
    return this.repo.list(filter);
  }

  async transition(id: string, toState: TaskRecord["state"], opts: { reason?: string; output?: Record<string, unknown>; error?: TaskRecord["error"] } = {}): Promise<TaskRecord> {
    const task = await this.repo.getById(id);
    if (!task) throw new NotFoundError("Task", id);

    if (!canTransition(task.state as any, toState as any)) {
      throw new ValidationError(`Invalid transition ${task.state} -> ${toState} for task ${id}`);
    }

    const updated = await this.repo.update(id, {
      state: toState,
      fromState: task.state,
      output: opts.output ?? task.output,
      error: opts.error ?? task.error,
      reason: opts.reason,
    } as any);

    if (!updated) throw new NotFoundError("Task", id);

    // Publish event based on state
    const eventMap: Record<string, AgentMeshEvent["type"]> = {
      [TaskState.WORKING]: "task.started",
      [TaskState.COMPLETED]: "task.completed",
      [TaskState.FAILED]: "task.failed",
      [TaskState.CANCELED]: "task.canceled",
      [TaskState.TIMEOUT]: "task.timeout",
    };

    const eventType = eventMap[toState];
    if (eventType) {
      await this.publishEvent(eventType, id, { task: updated, reason: opts.reason });
    }

    return updated;
  }

  async cancel(id: string, reason = "Canceled by user"): Promise<TaskRecord> {
    const task = await this.getById(id);
    if ([TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELED, TaskState.REJECTED].includes(task.state as any)) {
      throw new ValidationError(`Task ${id} is already terminal: ${task.state}`);
    }
    return this.transition(id, TaskState.CANCELED, { reason });
  }

  async complete(id: string, output?: Record<string, unknown>): Promise<TaskRecord> {
    return this.transition(id, TaskState.COMPLETED, { output, reason: "Task completed" });
  }

  async fail(id: string, error: { code: string; message: string; details?: unknown }): Promise<TaskRecord> {
    return this.transition(id, TaskState.FAILED, { error, reason: error.message });
  }

  async retry(id: string): Promise<TaskRecord> {
    const task = await this.getById(id);
    if (![TaskState.FAILED, TaskState.TIMEOUT].includes(task.state as any)) {
      throw new ValidationError(`Only FAILED or TIMEOUT tasks can be retried, got ${task.state}`);
    }
    if (task.attempts >= task.maxAttempts) {
      throw new ValidationError(`Task ${id} has reached max attempts ${task.maxAttempts}`);
    }

    // Transition back to SUBMITTED with incremented attempts
    const updated = await this.repo.update(id, {
      state: TaskState.SUBMITTED,
      fromState: task.state,
      attempts: task.attempts + 1,
      reason: "Retrying task",
    } as any);

    if (!updated) throw new NotFoundError("Task", id);

    await this.publishEvent("task.created", id, { task: updated, retry: true });

    // Auto transition to WORKING
    setImmediate(() => this.transition(id, TaskState.WORKING, { reason: "Retry delegated" }).catch(() => {}));

    return updated as TaskRecord;
  }

  async getHistory(id: string): Promise<any[]> {
    await this.getById(id); // ensure exists
    return this.repo.getHistory(id);
  }

  async getDelegationTree(rootTaskId: string): Promise<{ tree: TaskRecord[]; graph: any }> {
    const tasks = await this.repo.getDelegationTree(rootTaskId);
    if (tasks.length === 0) throw new NotFoundError("Task", rootTaskId);

    // Build simple graph for visualization
    const nodes = tasks.map((t) => ({ id: t.id, label: `${t.id.slice(0, 8)} (${t.state})`, state: t.state, agentId: t.agentId }));
    const edges: any[] = [];

    for (const task of tasks) {
      if (task.parentTaskId) {
        edges.push({ from: task.parentTaskId, to: task.id, agentId: task.agentId });
      }
    }

    return { tree: tasks, graph: { nodes, edges, root: rootTaskId } };
  }

  private async publishEvent(type: AgentMeshEvent["type"], taskId: string, data: unknown): Promise<void> {
    try {
      const event: AgentMeshEvent = {
        id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        source: "control-plane",
        subject: `task.${taskId}`,
        data,
        timestamp: new Date().toISOString(),
      };
      await this.eventBus.publish(event);
    } catch (err) {
      console.warn(`[tasks] failed to publish event ${type}: ${(err as Error).message}`);
    }
  }
}

let serviceInstance: TaskService | null = null;

export function getTaskService(): TaskService {
  if (!serviceInstance) serviceInstance = new TaskService();
  return serviceInstance;
}
