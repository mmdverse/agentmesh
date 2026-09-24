import { getTaskRepository } from "./repository.js";
import { getRegistryService } from "../registry/service.js";
import { createEventBus, type AgentMeshEvent } from "@agentmesh/events";
import type { CreateTaskInput, TaskRecord, TaskFilter } from "./types.js";
import { TaskState, generateId, nowIso, canTransition, NotFoundError, ValidationError, AuthorizationError } from "@agentmesh/core";
import { getTenantManager, type TenantContext } from "@agentmesh/tenancy";
import { DEFAULT_RESOURCE_LIMITS, checkResourceLimits } from "@agentmesh/rate-limit";
import { DelegationManager } from "@agentmesh/authorization";
import { CircuitBreaker, Bulkhead, FanOutLimiter, withTimeout } from "@agentmesh/reliability";

export class TaskService {
  private repo = getTaskRepository();
  private registry = getRegistryService();
  private eventBus = createEventBus({ serviceName: "control-plane-tasks", url: process.env.NATS_URL });
  private tenantManager = getTenantManager();
  private delegationManager = new DelegationManager();
  private fanOutLimiter = new FanOutLimiter({ maxFanOut: DEFAULT_RESOURCE_LIMITS.maxFanOut, windowMs: 60000 });
  private agentBreakers = new Map<string, CircuitBreaker>();
  private agentBulkheads = new Map<string, Bulkhead>();

  private getBreaker(agentId: string): CircuitBreaker {
    if (!this.agentBreakers.has(agentId)) {
      this.agentBreakers.set(agentId, new CircuitBreaker({ failureThreshold: 5, timeoutMs: 60000 }));
    }
    return this.agentBreakers.get(agentId)!;
  }

  private getBulkhead(agentId: string): Bulkhead {
    if (!this.agentBulkheads.has(agentId)) {
      this.agentBulkheads.set(agentId, new Bulkhead({ maxConcurrent: 20, maxQueue: 50 }));
    }
    return this.agentBulkheads.get(agentId)!;
  }

  async create(input: CreateTaskInput & { tenant?: TenantContext }): Promise<TaskRecord> {
    // Tenant validation
    if (input.tenant) {
      this.tenantManager.validateContext(input.tenant);
      input.organizationId = input.organizationId ?? input.tenant.organizationId;
      input.projectId = input.projectId ?? input.tenant.projectId;
    }

    // Resource limits: message size
    const messageSize = JSON.stringify(input.message).length;
    const resourceCheck = checkResourceLimits(DEFAULT_RESOURCE_LIMITS, { messageSize });
    if (!resourceCheck.allowed) {
      throw new ValidationError(resourceCheck.reason ?? "Message too large");
    }

    // Delegation verification if delegationId provided
    let delegationChain: string[] = [];
    if (input.delegationId) {
      const verification = this.delegationManager.verify(input.delegationId);
      if (!verification.valid) {
        throw new AuthorizationError(`Invalid delegation: ${verification.reason}`);
      }
      delegationChain = verification.delegation?.chain ?? [];
      delegationChain.push(input.delegationId);
    }

    // Validate agent exists with tenant isolation
    let agent;
    try {
      agent = await this.registry.getById(input.agentId, { tenant: input.tenant });
    } catch {
      throw new NotFoundError("Agent", input.agentId);
    }

    // Tenant isolation: task tenant must match agent tenant
    if (input.tenant && (agent.organizationId || agent.projectId)) {
      this.tenantManager.enforce(input.tenant, {
        organizationId: agent.organizationId ?? undefined,
        projectId: agent.projectId ?? undefined,
      });
    }

    // Fan-out limit check (prevent delegation explosions)
    if (input.parentTaskId) {
      const fanOutCheck = this.fanOutLimiter.check(input.parentTaskId, 1);
      if (!fanOutCheck.allowed) {
        throw new ValidationError(`Fan-out limit exceeded for parent ${input.parentTaskId}: ${fanOutCheck.reason}`);
      }
      // Also check depth to prevent infinite delegation
      const parent = await this.repo.getById(input.parentTaskId);
      if (parent) {
        const depth = parent.delegationChain?.length ?? 0;
        if (depth > 10) {
          throw new ValidationError(`Delegation depth exceeded (max 10) for task ${input.parentTaskId}`);
        }
        delegationChain = [...(parent.delegationChain ?? []), ...delegationChain];
      }
    }

    // Concurrent task limit per agent (bulkhead)
    const bulkhead = this.getBulkhead(input.agentId);
    const bulkheadCheck = bulkhead.tryAcquire();
    if (!bulkheadCheck.allowed) {
      throw new ValidationError(`Agent ${input.agentId} at capacity: ${bulkhead.getStats().currentConcurrent} concurrent tasks`);
    }

    // Circuit breaker check
    const breaker = this.getBreaker(input.agentId);
    if (breaker.getState() === "OPEN") {
      bulkhead.release();
      throw new ValidationError(`Agent ${input.agentId} circuit breaker OPEN - too many failures`);
    }

    if (agent.health === "UNHEALTHY") {
      console.warn(`[tasks] creating task for unhealthy agent ${input.agentId}, but allowing (will track failure)`);
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
      delegationChain,
    };

    const created = await this.repo.create(task);

    await this.publishEvent("task.created", id, { task: created, agentId: input.agentId }, input.tenant);

    // Transition to WORKING asynchronously with timeout protection
    setImmediate(async () => {
      try {
        await withTimeout(
          () => this.transition(id, TaskState.WORKING, { reason: "Task delegated to agent", tenant: input.tenant }),
          5000,
          `Transition to WORKING timeout for ${id}`
        );
      } catch (err) {
        console.error(`[tasks] failed to transition task ${id} to WORKING: ${(err as Error).message}`);
        bulkhead.release();
      }
    });

    // Release bulkhead after a delay (simulating task start) - in real impl, release on completion
    // For Phase 3, we keep bulkhead acquired until task completes (release in complete/fail)
    // So we don't release here, but store for later release

    return created;
  }

  async getById(id: string, tenant?: TenantContext): Promise<TaskRecord> {
    const task = await this.repo.getById(id);
    if (!task) throw new NotFoundError("Task", id);

    if (tenant && (task.organizationId || task.projectId)) {
      this.tenantManager.enforce(tenant, {
        organizationId: task.organizationId ?? undefined,
        projectId: task.projectId ?? undefined,
      });
    }

    return task;
  }

  async list(filter: TaskFilter & { tenant?: TenantContext }): Promise<{ tasks: TaskRecord[]; total: number }> {
    if (filter.tenant) {
      filter.organizationId = filter.organizationId ?? filter.tenant.organizationId;
      filter.projectId = filter.projectId ?? filter.tenant.projectId;
    }
    return this.repo.list(filter);
  }

  async transition(
    id: string,
    toState: TaskRecord["state"],
    opts: { reason?: string; output?: Record<string, unknown>; error?: TaskRecord["error"]; tenant?: TenantContext } = {}
  ): Promise<TaskRecord> {
    const task = await this.repo.getById(id);
    if (!task) throw new NotFoundError("Task", id);

    if (opts.tenant && (task.organizationId || task.projectId)) {
      this.tenantManager.enforce(opts.tenant, {
        organizationId: task.organizationId ?? undefined,
        projectId: task.projectId ?? undefined,
      });
    }

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

    // Update circuit breaker on failure
    if (toState === TaskState.FAILED) {
      this.getBreaker(task.agentId).recordFailure();
    } else if (toState === TaskState.COMPLETED) {
      this.getBreaker(task.agentId).recordSuccess();
    }

    // Release bulkhead on terminal states
    if ([TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELED, TaskState.REJECTED, TaskState.TIMEOUT].includes(toState as any)) {
      this.getBulkhead(task.agentId).release();
      if (task.parentTaskId) {
        this.fanOutLimiter.release(task.parentTaskId);
      }
    }

    const eventMap: Record<string, AgentMeshEvent["type"]> = {
      [TaskState.WORKING]: "task.started",
      [TaskState.COMPLETED]: "task.completed",
      [TaskState.FAILED]: "task.failed",
      [TaskState.CANCELED]: "task.canceled",
      [TaskState.TIMEOUT]: "task.timeout",
    };

    const eventType = eventMap[toState];
    if (eventType) {
      await this.publishEvent(eventType, id, { task: updated, reason: opts.reason }, opts.tenant);
    }

    return updated;
  }

  async cancel(id: string, reason = "Canceled by user", tenant?: TenantContext): Promise<TaskRecord> {
    const task = await this.getById(id, tenant);
    if ([TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELED, TaskState.REJECTED].includes(task.state as any)) {
      throw new ValidationError(`Task ${id} is already terminal: ${task.state}`);
    }
    return this.transition(id, TaskState.CANCELED, { reason, tenant });
  }

  async complete(id: string, output?: Record<string, unknown>, tenant?: TenantContext): Promise<TaskRecord> {
    // Resource limit check on output size
    if (output) {
      const size = JSON.stringify(output).length;
      const check = checkResourceLimits(DEFAULT_RESOURCE_LIMITS, { messageSize: size });
      if (!check.allowed) throw new ValidationError(check.reason ?? "Output too large");
    }
    return this.transition(id, TaskState.COMPLETED, { output, reason: "Task completed", tenant });
  }

  async fail(id: string, error: { code: string; message: string; details?: unknown }, tenant?: TenantContext): Promise<TaskRecord> {
    return this.transition(id, TaskState.FAILED, { error, reason: error.message, tenant });
  }

  async retry(id: string, tenant?: TenantContext): Promise<TaskRecord> {
    const task = await this.getById(id, tenant);
    if (![TaskState.FAILED, TaskState.TIMEOUT].includes(task.state as any)) {
      throw new ValidationError(`Only FAILED or TIMEOUT tasks can be retried, got ${task.state}`);
    }
    if (task.attempts >= task.maxAttempts) {
      throw new ValidationError(`Task ${id} has reached max attempts ${task.maxAttempts}`);
    }

    const updated = await this.repo.update(id, {
      state: TaskState.SUBMITTED,
      fromState: task.state,
      attempts: task.attempts + 1,
      reason: "Retrying task",
    } as any);

    if (!updated) throw new NotFoundError("Task", id);

    await this.publishEvent("task.created", id, { task: updated, retry: true }, tenant);

    setImmediate(() => this.transition(id, TaskState.WORKING, { reason: "Retry delegated", tenant }).catch(() => {}));

    return updated as TaskRecord;
  }

  async getHistory(id: string, tenant?: TenantContext): Promise<any[]> {
    await this.getById(id, tenant);
    return this.repo.getHistory(id);
  }

  async getDelegationTree(rootTaskId: string, tenant?: TenantContext): Promise<{ tree: TaskRecord[]; graph: any }> {
    const tasks = await this.repo.getDelegationTree(rootTaskId);
    if (tasks.length === 0) throw new NotFoundError("Task", rootTaskId);

    if (tenant) {
      for (const t of tasks) {
        if (t.organizationId || t.projectId) {
          this.tenantManager.enforce(tenant, {
            organizationId: t.organizationId ?? undefined,
            projectId: t.projectId ?? undefined,
          });
        }
      }
    }

    const nodes = tasks.map((t) => ({ id: t.id, label: `${t.id.slice(0, 8)} (${t.state})`, state: t.state, agentId: t.agentId }));
    const edges: any[] = [];

    for (const task of tasks) {
      if (task.parentTaskId) {
        edges.push({ from: task.parentTaskId, to: task.id, agentId: task.agentId });
      }
    }

    return { tree: tasks, graph: { nodes, edges, root: rootTaskId } };
  }

  // For testing / admin: get reliability stats
  getReliabilityStats(): Record<string, any> {
    const breakers: Record<string, any> = {};
    for (const [agentId, breaker] of this.agentBreakers.entries()) {
      breakers[agentId] = breaker.getStats();
    }
    const bulkheads: Record<string, any> = {};
    for (const [agentId, bulkhead] of this.agentBulkheads.entries()) {
      bulkheads[agentId] = bulkhead.getStats();
    }
    return {
      breakers,
      bulkheads,
      fanOut: this.fanOutLimiter.getStats(),
    };
  }

  private async publishEvent(type: AgentMeshEvent["type"], taskId: string, data: unknown, tenant?: TenantContext): Promise<void> {
    try {
      const event: AgentMeshEvent = {
        id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        source: "control-plane",
        subject: `task.${taskId}`,
        data,
        timestamp: new Date().toISOString(),
        organizationId: tenant?.organizationId ?? (data as any)?.task?.organizationId,
        projectId: tenant?.projectId ?? (data as any)?.task?.projectId,
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
