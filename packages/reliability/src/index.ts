/**
 * Reliability primitives - Production-grade
 * Circuit Breaker, Bulkhead, Retry, Timeout, Deduplication, Idempotency, FanOut
 */

// Circuit Breaker

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  successThreshold?: number;
  timeoutMs?: number;
  halfOpenMaxCalls?: number;
  name?: string;
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private successes = 0;
  private nextAttempt = 0;
  private halfOpenCalls = 0;

  constructor(private config: CircuitBreakerConfig = {}) {
    this.config.failureThreshold = config.failureThreshold ?? 5;
    this.config.successThreshold = config.successThreshold ?? 2;
    this.config.timeoutMs = config.timeoutMs ?? 60000;
    this.config.halfOpenMaxCalls = config.halfOpenMaxCalls ?? 3;
    this.config.name = config.name ?? "circuit";
  }

  getState(): CircuitState {
    if (this.state === "OPEN" && Date.now() > this.nextAttempt) {
      this.state = "HALF_OPEN";
      this.halfOpenCalls = 0;
      this.successes = 0;
    }
    return this.state;
  }

  getStats(): {
    state: CircuitState;
    failures: number;
    successes: number;
    nextAttempt: number;
    name: string;
  } {
    return {
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      nextAttempt: this.nextAttempt,
      name: this.config.name!,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === "OPEN") {
      throw new Error(
        `Circuit ${this.config.name} is OPEN, next attempt at ${new Date(this.nextAttempt).toISOString()}`
      );
    }
    if (state === "HALF_OPEN") {
      if (this.halfOpenCalls >= (this.config.halfOpenMaxCalls ?? 3)) {
        throw new Error(`Circuit ${this.config.name} is HALF_OPEN and max calls reached`);
      }
      this.halfOpenCalls++;
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  recordSuccess(): void {
    this.onSuccess();
  }

  recordFailure(): void {
    this.onFailure();
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.successes++;
      if (this.successes >= (this.config.successThreshold ?? 2)) {
        this.state = "CLOSED";
        this.failures = 0;
        this.successes = 0;
        console.log(`[circuit:${this.config.name}] CLOSED (recovered)`);
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    if (this.state === "HALF_OPEN" || this.failures >= (this.config.failureThreshold ?? 5)) {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + (this.config.timeoutMs ?? 60000);
      this.successes = 0;
      console.warn(
        `[circuit:${this.config.name}] OPEN after ${this.failures} failures, next attempt at ${new Date(this.nextAttempt).toISOString()}`
      );
    }
  }

  reset(): void {
    this.state = "CLOSED";
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = 0;
  }
}

// Bulkhead

export interface BulkheadConfig {
  maxConcurrent?: number;
  maxQueue?: number;
  name?: string;
}

export class Bulkhead {
  private active = 0;
  private queue: Array<{
    fn: () => Promise<any>;
    resolve: (v: any) => void;
    reject: (e: any) => void;
  }> = [];

  constructor(private config: BulkheadConfig = {}) {
    this.config.maxConcurrent = config.maxConcurrent ?? 10;
    this.config.maxQueue = config.maxQueue ?? 100;
    this.config.name = config.name ?? "bulkhead";
  }

  tryAcquire(): { allowed: boolean; reason?: string } {
    if (this.active >= (this.config.maxConcurrent ?? 10)) {
      if (this.queue.length >= (this.config.maxQueue ?? 100)) {
        return {
          allowed: false,
          reason: `Bulkhead ${this.config.name} at capacity ${this.active}/${this.config.maxConcurrent} queue ${this.queue.length}/${this.config.maxQueue}`,
        };
      }
    }
    this.active++;
    return { allowed: true };
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    this.next();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= (this.config.maxConcurrent ?? 10)) {
      if (this.queue.length >= (this.config.maxQueue ?? 100)) {
        throw new Error(`Bulkhead ${this.config.name} queue full (${this.config.maxQueue})`);
      }
      return new Promise<T>((resolve, reject) => {
        this.queue.push({ fn: fn as any, resolve, reject });
      });
    }
    return this.run(fn);
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.active++;
    try {
      const result = await fn();
      return result;
    } finally {
      this.active--;
      this.next();
    }
  }

  private next(): void {
    if (this.queue.length > 0 && this.active < (this.config.maxConcurrent ?? 10)) {
      const next = this.queue.shift()!;
      this.run(next.fn).then(next.resolve).catch(next.reject);
    }
  }

  getStats(): {
    active: number;
    queued: number;
    maxConcurrent: number;
    maxQueue: number;
    currentConcurrent: number;
  } {
    return {
      active: this.active,
      queued: this.queue.length,
      maxConcurrent: this.config.maxConcurrent ?? 10,
      maxQueue: this.config.maxQueue ?? 100,
      currentConcurrent: this.active,
    };
  }
}

// Retry

export interface RetryConfig {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
  retryable?: (err: Error) => boolean;
}

export async function retry<T>(fn: () => Promise<T>, config: RetryConfig = {}): Promise<T> {
  const maxAttempts = config.maxAttempts ?? 3;
  const initialDelay = config.initialDelayMs ?? 100;
  const maxDelay = config.maxDelayMs ?? 10000;
  const factor = config.backoffFactor ?? 2;
  const jitter = config.jitter ?? true;

  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err as Error;
      if (config.retryable && !config.retryable(err as Error)) throw err;
      if (attempt === maxAttempts - 1) break;
      let delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);
      if (jitter) delay = delay * (0.5 + Math.random() * 0.5);
      console.warn(
        `[retry] attempt ${attempt + 1}/${maxAttempts} failed: ${(err as Error).message}, retrying in ${Math.round(delay)}ms`
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr ?? new Error("Retry failed after max attempts");
}

// Timeout

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  message = "Operation timed out"
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new Error(`${message} after ${timeoutMs}ms`))
        );
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Deduplication / Idempotency

export class Deduplicator {
  private seen = new Map<string, { expiresAt: number; result?: unknown }>();

  constructor(
    private ttlMs = 60000,
    private cleanupIntervalMs = 30000
  ) {
    const interval = setInterval(() => this.cleanup(), cleanupIntervalMs);
    if ((interval as any).unref) (interval as any).unref();
  }

  isDuplicate(key: string): boolean {
    const entry = this.seen.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.seen.delete(key);
      return false;
    }
    return true;
  }

  markSeen(key: string, result?: unknown): void {
    this.seen.set(key, { expiresAt: Date.now() + this.ttlMs, result });
  }

  getResult<T>(key: string): T | undefined {
    const entry = this.seen.get(key);
    if (!entry || entry.expiresAt < Date.now()) return undefined;
    return entry.result as T;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [k, v] of this.seen.entries()) {
      if (v.expiresAt < now) this.seen.delete(k);
    }
  }
}

export class IdempotencyStore {
  private store = new Map<string, { response: unknown; createdAt: number; expiresAt: number }>();

  constructor(private ttlMs = 24 * 60 * 60 * 1000) {}

  get(key: string): unknown | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.response;
  }

  set(key: string, response: unknown): void {
    this.store.set(key, { response, createdAt: Date.now(), expiresAt: Date.now() + this.ttlMs });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

// Fan-out protection

export interface FanOutLimiterConfig {
  maxFanOut: number;
  windowMs?: number;
}

export class FanOutLimiter {
  private counts = new Map<string, { count: number; resetAt: number }>();
  private maxFanOut: number;
  private windowMs: number;

  constructor(config: FanOutLimiterConfig | number) {
    if (typeof config === "number") {
      this.maxFanOut = config;
      this.windowMs = 60000;
    } else {
      this.maxFanOut = config.maxFanOut;
      this.windowMs = config.windowMs ?? 60000;
    }
  }

  check(key: string, increment = 1): { allowed: boolean; reason?: string; current: number } {
    const now = Date.now();
    let entry = this.counts.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.counts.set(key, entry);
    }
    if (entry.count + increment > this.maxFanOut) {
      return {
        allowed: false,
        reason: `Fan-out ${entry.count + increment} exceeds limit ${this.maxFanOut} for ${key}`,
        current: entry.count,
      };
    }
    entry.count += increment;
    return { allowed: true, current: entry.count };
  }

  release(key: string): void {
    const entry = this.counts.get(key);
    if (entry) {
      entry.count = Math.max(0, entry.count - 1);
    }
  }

  getStats(): Record<string, { count: number; resetAt: number }> {
    const out: Record<string, any> = {};
    for (const [k, v] of this.counts.entries()) out[k] = v;
    return out;
  }

  reset(): void {
    this.counts.clear();
  }

  // Legacy compat for old API check(fanOut: number)
  checkLegacy(fanOut: number): void {
    if (fanOut > this.maxFanOut)
      throw new Error(`Fan-out limit exceeded: ${fanOut} > ${this.maxFanOut}`);
  }

  getCount(): number {
    let total = 0;
    for (const v of this.counts.values()) total += v.count;
    return total;
  }
}
