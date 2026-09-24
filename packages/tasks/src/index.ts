import { TaskState, canTransition, nowIso, type TaskId, type AgentId, type ContextId, type SessionId, type TraceId } from "@agentmesh/core";
import { z } from "zod";

export const TaskSchema = z.object({
  id: z.string().min(1),
  rootTaskId: z.string().min(1),
  parentTaskId: z.string().optional(),
  agentId: z.string().min(1),
  sessionId: z.string().min(1),
  contextId: z.string().min(1),
  traceId: z.string().min(1),
  state: z.nativeEnum(TaskState),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }).optional(),
  metadata: z.record(z.unknown()).optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  attempts: z.number().int().min(0).default(0),
  maxAttempts: z.number().int().min(1).default(3),
});

export type Task = z.infer<typeof TaskSchema>;

export const TaskHistorySchema = z.object({
  id: z.string(),
  taskId: z.string(),
  fromState: z.nativeEnum(TaskState).nullable(),
  toState: z.nativeEnum(TaskState),
  reason: z.string().optional(),
  actorId: z.string().optional(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type TaskHistory = z.infer<typeof TaskHistorySchema>;

export const TaskEdgeSchema = z.object({
  parentTaskId: z.string(),
  childTaskId: z.string(),
  agentId: z.string(),
  createdAt: z.string().datetime(),
});

export type TaskEdge = z.infer<typeof TaskEdgeSchema>;

export class TaskStateMachine {
  static create(params: {
    id: string;
    rootTaskId?: string;
    parentTaskId?: string;
    agentId: string;
    sessionId: string;
    contextId: string;
    traceId: string;
    input?: Record<string, unknown>;
    organizationId?: string;
    projectId?: string;
  }): Task {
    const now = nowIso();
    return {
      id: params.id,
      rootTaskId: params.rootTaskId ?? params.id,
      parentTaskId: params.parentTaskId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      contextId: params.contextId,
      traceId: params.traceId,
      state: TaskState.SUBMITTED,
      input: params.input,
      organizationId: params.organizationId,
      projectId: params.projectId,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      maxAttempts: 3,
    };
  }

  static transition(task: Task, to: Task["state"], opts?: { reason?: string; output?: Record<string, unknown>; error?: Task["error"] }): Task {
    if (!canTransition(task.state, to)) {
      throw new Error(`Invalid transition ${task.state} -> ${to} for task ${task.id}`);
    }
    const now = nowIso();
    return {
      ...task,
      state: to,
      output: opts?.output ?? task.output,
      error: opts?.error ?? (to === "FAILED" ? task.error : undefined),
      updatedAt: now,
      attempts: to === "SUBMITTED" ? task.attempts + 1 : task.attempts,
    };
  }

  static isTerminal(state: TaskState): boolean {
    return ["COMPLETED", "FAILED", "CANCELED", "REJECTED"].includes(state);
  }

  static isRetryable(task: Task): boolean {
    return (task.state === "FAILED" || task.state === "TIMEOUT") && task.attempts < task.maxAttempts;
  }
}

// Delegation Tree Builder
export interface DelegationNode {
  task: Task;
  children: DelegationNode[];
}

export function buildDelegationTree(tasks: Task[], edges: TaskEdge[]): DelegationNode[] {
  const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]));
  const childrenMap = new Map<string, string[]>();

  for (const edge of edges) {
    const list = childrenMap.get(edge.parentTaskId) ?? [];
    list.push(edge.childTaskId);
    childrenMap.set(edge.parentTaskId, list);
  }

  const visited = new Set<string>();

  function buildNode(taskId: string): DelegationNode | null {
    if (visited.has(taskId)) return null;
    visited.add(taskId);
    const task = taskMap.get(taskId);
    if (!task) return null;
    const childIds = childrenMap.get(taskId) ?? [];
    const children = childIds.map(buildNode).filter(Boolean) as DelegationNode[];
    return { task, children };
  }

  const roots = tasks.filter((t) => t.id === t.rootTaskId);
  return roots.map((r) => buildNode(r.id)).filter(Boolean) as DelegationNode[];
}
