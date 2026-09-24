/**
 * Rate Limiting - Production-grade
 * Supports: Token Bucket, Fixed Window, Sliding Window
 * Keys: org, project, agent, identity, skill, endpoint, task, IP
 */

// Store interface

export interface RateLimitStore {
  get(key: string): Promise<{ count: number; resetAt: number } | null>;
  incr(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}

// In-memory store for Phase 3 (Redis will be used in production via adapter)

export class InMemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetAt: number; windowMs: number }>();

  async get(key: string): Promise<{ count: number; resetAt: number } | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.resetAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return { count: entry.count, resetAt: entry.resetAt };
  }

  async incr(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || existing.resetAt < now) {
      const resetAt = now + windowMs;
      this.store.set(key, { count: 1, resetAt, windowMs });
      return { count: 1, resetAt };
    }

    existing.count++;
    this.store.set(key, existing);
    return { count: existing.count, resetAt: existing.resetAt };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// Token Bucket

export interface TokenBucketConfig {
  capacity: number; // max tokens
  refillRate: number; // tokens per second
  refillIntervalMs?: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(private config: TokenBucketConfig) {
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
  }

  tryConsume(count = 1): { allowed: boolean; remaining: number; retryAfterMs?: number } {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return { allowed: true, remaining: Math.floor(this.tokens) };
    }

    const needed = count - this.tokens;
    const retryAfterMs = (needed / this.config.refillRate) * 1000;
    return { allowed: false, remaining: Math.floor(this.tokens), retryAfterMs };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refillInterval = this.config.refillIntervalMs ?? 1000;
    const intervals = Math.floor(elapsed / refillInterval);

    if (intervals > 0) {
      const newTokens = intervals * this.config.refillRate * (refillInterval / 1000);
      this.tokens = Math.min(this.config.capacity, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }
}

// Fixed Window

export interface FixedWindowConfig {
  limit: number;
  windowMs: number;
}

export class FixedWindowRateLimiter {
  constructor(
    private store: RateLimitStore,
    private config: FixedWindowConfig
  ) {}

  async isAllowed(
    key: string
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number; count: number }> {
    const { count, resetAt } = await this.store.incr(key, this.config.windowMs);
    const allowed = count <= this.config.limit;
    const remaining = Math.max(0, this.config.limit - count);
    return { allowed, remaining, resetAt, count };
  }
}

// Sliding Window (more accurate)

export class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>();

  constructor(private config: FixedWindowConfig) {}

  async isAllowed(
    key: string
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number; count: number }> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let timestamps = this.windows.get(key) ?? [];
    timestamps = timestamps.filter(t => t > windowStart);

    const allowed = timestamps.length < this.config.limit;
    const remaining = Math.max(0, this.config.limit - timestamps.length - (allowed ? 1 : 0));

    if (allowed) {
      timestamps.push(now);
      this.windows.set(key, timestamps);
    }

    const resetAt =
      timestamps.length > 0 ? timestamps[0] + this.config.windowMs : now + this.config.windowMs;

    return { allowed, remaining, resetAt, count: timestamps.length };
  }
}

// Multi-dimensional Rate Limiter - supports org, project, agent, skill, etc.

export type RateLimitDimension =
  | "organization"
  | "project"
  | "agent"
  | "identity"
  | "skill"
  | "endpoint"
  | "task"
  | "ip"
  | "global";

export interface RateLimitRule {
  dimension: RateLimitDimension;
  limit: number;
  windowMs: number;
  strategy?: "fixed_window" | "sliding_window" | "token_bucket";
}

export interface RateLimitContext {
  organizationId?: string;
  projectId?: string;
  agentId?: string;
  identityId?: string;
  skill?: string;
  endpoint?: string;
  taskId?: string;
  ip?: string;
}

export class MultiDimensionalRateLimiter {
  private limiters = new Map<string, FixedWindowRateLimiter | SlidingWindowRateLimiter>();
  private rules: RateLimitRule[] = [];
  private store: RateLimitStore;

  constructor(store?: RateLimitStore) {
    this.store = store ?? new InMemoryRateLimitStore();
  }

  addRule(rule: RateLimitRule): void {
    this.rules.push(rule);
    const key = this.ruleKey(rule);
    if (rule.strategy === "sliding_window") {
      this.limiters.set(
        key,
        new SlidingWindowRateLimiter({ limit: rule.limit, windowMs: rule.windowMs })
      );
    } else {
      this.limiters.set(
        key,
        new FixedWindowRateLimiter(this.store, { limit: rule.limit, windowMs: rule.windowMs })
      );
    }
  }

  async check(
    ctx: RateLimitContext
  ): Promise<{ allowed: boolean; reason?: string; limit?: RateLimitRule; result?: any }> {
    for (const rule of this.rules) {
      const dimensionKey = this.getDimensionKey(rule.dimension, ctx);
      if (!dimensionKey) continue; // skip if dimension not present in context

      const limiterKey = `${this.ruleKey(rule)}:${dimensionKey}`;
      const limiter = this.limiters.get(this.ruleKey(rule));
      if (!limiter) continue;

      const result = await limiter.isAllowed(limiterKey);
      if (!result.allowed) {
        return {
          allowed: false,
          reason: `Rate limit exceeded for ${rule.dimension}=${dimensionKey}: ${result.count}/${rule.limit} per ${rule.windowMs}ms`,
          limit: rule,
          result,
        };
      }
    }

    return { allowed: true };
  }

  private ruleKey(rule: RateLimitRule): string {
    return `${rule.dimension}:${rule.limit}:${rule.windowMs}:${rule.strategy ?? "fixed_window"}`;
  }

  private getDimensionKey(dimension: RateLimitDimension, ctx: RateLimitContext): string | null {
    switch (dimension) {
      case "organization":
        return ctx.organizationId ?? null;
      case "project":
        return ctx.projectId ?? null;
      case "agent":
        return ctx.agentId ?? null;
      case "identity":
        return ctx.identityId ?? null;
      case "skill":
        return ctx.skill ?? null;
      case "endpoint":
        return ctx.endpoint ?? null;
      case "task":
        return ctx.taskId ?? null;
      case "ip":
        return ctx.ip ?? null;
      case "global":
        return "global";
      default:
        return null;
    }
  }
}

// Default rules for AgentMesh

export function createDefaultRateLimiter(): MultiDimensionalRateLimiter {
  const limiter = new MultiDimensionalRateLimiter();

  // Global: 1000 req/sec
  limiter.addRule({ dimension: "global", limit: 1000, windowMs: 1000 });

  // Per IP: 100 req/sec
  limiter.addRule({ dimension: "ip", limit: 100, windowMs: 1000 });

  // Per organization: 500 req/sec
  limiter.addRule({ dimension: "organization", limit: 500, windowMs: 1000 });

  // Per project: 200 req/sec
  limiter.addRule({ dimension: "project", limit: 200, windowMs: 1000 });

  // Per agent: 50 req/sec
  limiter.addRule({ dimension: "agent", limit: 50, windowMs: 1000 });

  // Per skill: 100 req/sec
  limiter.addRule({ dimension: "skill", limit: 100, windowMs: 1000 });

  // Per identity: 100 req/sec
  limiter.addRule({ dimension: "identity", limit: 100, windowMs: 1000 });

  return limiter;
}

// Resource Limits

export interface ResourceLimits {
  maxMessageSize?: number; // bytes
  maxArtifactSize?: number;
  maxConcurrentTasks?: number;
  maxTaskDurationMs?: number;
  maxStreamingDurationMs?: number;
  maxFanOut?: number;
  maxRetries?: number;
}

export const DEFAULT_RESOURCE_LIMITS: Required<ResourceLimits> = {
  maxMessageSize: 1024 * 1024, // 1MB
  maxArtifactSize: 100 * 1024 * 1024, // 100MB
  maxConcurrentTasks: 100,
  maxTaskDurationMs: 30 * 60 * 1000, // 30m
  maxStreamingDurationMs: 60 * 60 * 1000, // 1h
  maxFanOut: 10,
  maxRetries: 3,
};

export function checkResourceLimits(
  limits: ResourceLimits,
  usage: Partial<ResourceLimits> & { messageSize?: number; artifactSize?: number }
): { allowed: boolean; reason?: string } {
  const merged = { ...DEFAULT_RESOURCE_LIMITS, ...limits };

  if (usage.messageSize && usage.messageSize > merged.maxMessageSize) {
    return {
      allowed: false,
      reason: `Message size ${usage.messageSize} exceeds limit ${merged.maxMessageSize}`,
    };
  }

  if (usage.artifactSize && usage.artifactSize > merged.maxArtifactSize) {
    return {
      allowed: false,
      reason: `Artifact size ${usage.artifactSize} exceeds limit ${merged.maxArtifactSize}`,
    };
  }

  if (usage.maxConcurrentTasks && usage.maxConcurrentTasks > merged.maxConcurrentTasks) {
    return {
      allowed: false,
      reason: `Concurrent tasks ${usage.maxConcurrentTasks} exceeds limit ${merged.maxConcurrentTasks}`,
    };
  }

  if (usage.maxFanOut && usage.maxFanOut > merged.maxFanOut) {
    return {
      allowed: false,
      reason: `Fan-out ${usage.maxFanOut} exceeds limit ${merged.maxFanOut}`,
    };
  }

  return { allowed: true };
}
