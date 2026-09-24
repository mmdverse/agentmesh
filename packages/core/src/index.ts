// Core domain - Task State Machine, IDs, Errors, Tenancy

export const TaskState = {
  SUBMITTED: "SUBMITTED",
  WORKING: "WORKING",
  INPUT_REQUIRED: "INPUT_REQUIRED",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELED: "CANCELED",
  REJECTED: "REJECTED",
  TIMEOUT: "TIMEOUT",
} as const;

export type TaskState = (typeof TaskState)[keyof typeof TaskState];

export const TaskStateTransitions: Record<TaskState, TaskState[]> = {
  [TaskState.SUBMITTED]: [
    TaskState.WORKING,
    TaskState.REJECTED,
    TaskState.CANCELED,
    TaskState.TIMEOUT,
  ],
  [TaskState.WORKING]: [
    TaskState.INPUT_REQUIRED,
    TaskState.AUTH_REQUIRED,
    TaskState.COMPLETED,
    TaskState.FAILED,
    TaskState.CANCELED,
    TaskState.TIMEOUT,
  ],
  [TaskState.INPUT_REQUIRED]: [
    TaskState.WORKING,
    TaskState.CANCELED,
    TaskState.TIMEOUT,
    TaskState.FAILED,
  ],
  [TaskState.AUTH_REQUIRED]: [
    TaskState.WORKING,
    TaskState.CANCELED,
    TaskState.TIMEOUT,
    TaskState.REJECTED,
  ],
  [TaskState.COMPLETED]: [],
  [TaskState.FAILED]: [TaskState.SUBMITTED], // retry can go back to SUBMITTED
  [TaskState.CANCELED]: [],
  [TaskState.REJECTED]: [],
  [TaskState.TIMEOUT]: [TaskState.SUBMITTED], // retry
};

export function canTransition(from: TaskState, to: TaskState): boolean {
  return TaskStateTransitions[from]?.includes(to) ?? false;
}

export function assertTransition(from: TaskState, to: TaskState): void {
  if (!canTransition(from, to)) {
    throw new TaskStateTransitionError(from, to);
  }
}

// IDs - ULID-like but using crypto random for now, will be replaced with proper ULID later
export type AgentId = string & { readonly brand: "AgentId" };
export type TaskId = string & { readonly brand: "TaskId" };
export type MessageId = string & { readonly brand: "MessageId" };
export type ArtifactId = string & { readonly brand: "ArtifactId" };
export type OrganizationId = string & { readonly brand: "OrganizationId" };
export type ProjectId = string & { readonly brand: "ProjectId" };
export type SessionId = string & { readonly brand: "SessionId" };
export type ContextId = string & { readonly brand: "ContextId" };
export type TraceId = string & { readonly brand: "TraceId" };

export function generateId(prefix?: string): string {
  const rand = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  return prefix ? `${prefix}_${rand}` : rand;
}

export const TrustLevel = {
  UNTRUSTED: "UNTRUSTED",
  EXTERNAL: "EXTERNAL",
  VERIFIED: "VERIFIED",
  ORGANIZATION: "ORGANIZATION",
  SYSTEM: "SYSTEM",
} as const;

export type TrustLevel = (typeof TrustLevel)[keyof typeof TrustLevel];

export const Transport = {
  JSONRPC_HTTP: "jsonrpc+http",
  SSE: "sse",
  GRPC: "grpc",
  WEBSOCKET: "websocket",
} as const;

export type Transport = (typeof Transport)[keyof typeof Transport];

// Tenancy
export interface TenantContext {
  organizationId: OrganizationId;
  projectId: ProjectId;
  identityId?: string; // caller identity
}

// Delegation
export interface DelegationChain {
  rootTaskId: TaskId;
  parentTaskId?: TaskId;
  taskId: TaskId;
  agentId: AgentId;
  sessionId: SessionId;
  contextId: ContextId;
  traceId: TraceId;
  depth: number;
  chain: Array<{ agentId: AgentId; taskId: TaskId; timestamp: string }>;
}

// Errors
export class AgentMeshError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly retryable: boolean;

  constructor(opts: {
    message: string;
    code: string;
    statusCode?: number;
    details?: unknown;
    retryable?: boolean;
  }) {
    super(opts.message);
    this.name = this.constructor.name;
    this.code = opts.code;
    this.statusCode = opts.statusCode ?? 500;
    this.details = opts.details;
    this.retryable = opts.retryable ?? false;
  }
}

export class TaskStateTransitionError extends AgentMeshError {
  constructor(from: TaskState, to: TaskState) {
    super({
      message: `Invalid task transition: ${from} -> ${to}`,
      code: "TASK_INVALID_TRANSITION",
      statusCode: 409,
    });
  }
}

export class NotFoundError extends AgentMeshError {
  constructor(resource: string, id: string) {
    super({
      message: `${resource} not found: ${id}`,
      code: `${resource.toUpperCase()}_NOT_FOUND`,
      statusCode: 404,
    });
  }
}

export class AuthorizationError extends AgentMeshError {
  constructor(message = "Unauthorized") {
    super({ message, code: "UNAUTHORIZED", statusCode: 403 });
  }
}

export class AuthenticationError extends AgentMeshError {
  constructor(message = "Authentication required") {
    super({ message, code: "AUTHENTICATION_REQUIRED", statusCode: 401 });
  }
}

export class ValidationError extends AgentMeshError {
  constructor(message: string, details?: unknown) {
    super({ message, code: "VALIDATION_ERROR", statusCode: 400, details });
  }
}

export class RateLimitError extends AgentMeshError {
  constructor(message = "Rate limit exceeded") {
    super({ message, code: "RATE_LIMIT_EXCEEDED", statusCode: 429, retryable: true });
  }
}

export class ConflictError extends AgentMeshError {
  constructor(message: string) {
    super({ message, code: "CONFLICT", statusCode: 409 });
  }
}

// Pagination
export interface Pagination {
  limit: number;
  offset: number;
  total?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}

// Time helpers
export function nowIso(): string {
  return new Date().toISOString();
}

export function isExpired(expiresAt: string | Date): boolean {
  const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return d.getTime() < Date.now();
}

export * from "./security.js";
