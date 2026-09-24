import type { TaskState } from "@agentmesh/core";

export interface CreateTaskInput {
  agentId: string;
  message: { text: string; role?: string; parts?: any[] };
  contextId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  parentTaskId?: string;
  organizationId?: string;
  projectId?: string;
  traceId?: string;
  delegationId?: string; // for delegation chain
}

export interface TaskRecord {
  id: string;
  rootTaskId: string;
  parentTaskId?: string | null;
  agentId: string;
  sessionId: string;
  contextId: string;
  traceId: string;
  organizationId?: string | null;
  projectId?: string | null;
  state: TaskState;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  error?: { code: string; message: string; details?: unknown } | null;
  metadata: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  delegationChain?: string[]; // chain of delegation IDs
}

export interface TaskHistoryRecord {
  id: string;
  taskId: string;
  fromState: TaskState | null;
  toState: TaskState;
  reason?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface TaskFilter {
  agentId?: string;
  state?: TaskState;
  contextId?: string;
  traceId?: string;
  organizationId?: string;
  projectId?: string;
  rootTaskId?: string;
  limit?: number;
  offset?: number;
}
