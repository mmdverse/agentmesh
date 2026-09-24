import { Redis, type RedisOptions } from "ioredis";

let redisInstance: Redis | null = null;

export interface RedisConfig {
  url: string;
  keyPrefix?: string;
  maxRetriesPerRequest?: number | null;
  enableOfflineQueue?: boolean;
  lazyConnect?: boolean;
}

export function createRedisClient(config: RedisConfig): Redis {
  const opts: RedisOptions = {
    maxRetriesPerRequest: config.maxRetriesPerRequest ?? null, // no retry limit, fail fast
    enableOfflineQueue: config.enableOfflineQueue ?? false,
    enableReadyCheck: true,
    lazyConnect: config.lazyConnect ?? true,
    retryStrategy: () => null, // don't retry connection
  };

  if (config.keyPrefix) opts.keyPrefix = config.keyPrefix;

  const client = config.url.startsWith("redis://") || config.url.startsWith("rediss://") ? new Redis(config.url, opts) : new Redis({ ...opts, host: config.url } as any);

  client.on("connect", () => console.log("[redis] connected"));
  client.on("ready", () => console.log("[redis] ready"));
  client.on("error", (err: any) => {
    // Don't spam logs for connection refused in dev
    if (err.message?.includes("ECONNREFUSED")) {
      console.warn("[redis] connection refused, using in-memory fallback");
    } else {
      console.error("[redis] error", err);
    }
  });
  client.on("close", () => console.log("[redis] closed"));

  // Try to connect but don't throw
  client.connect().catch(() => {
    console.warn("[redis] failed to connect, will use in-memory fallback");
  });

  return client;
}

export function getRedis(config?: RedisConfig): Redis {
  if (redisInstance) return redisInstance;
  const url = config?.url ?? process.env.REDIS_URL ?? "redis://localhost:6379";
  redisInstance = createRedisClient({ url, ...config });
  return redisInstance;
}

export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    try {
      await redisInstance.quit();
    } catch {}
    redisInstance = null;
  }
}

// Helpers with graceful fallback

export class RedisCache {
  private fallback = new Map<string, { value: string; expiresAt?: number }>();

  constructor(private redis: Redis, private prefix = "cache:") {}

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.prefix + key;
    try {
      const val = await this.redis.get(fullKey);
      if (!val) {
        // Check fallback
        const fb = this.fallback.get(fullKey);
        if (!fb) return null;
        if (fb.expiresAt && fb.expiresAt < Date.now()) {
          this.fallback.delete(fullKey);
          return null;
        }
        try {
          return JSON.parse(fb.value) as T;
        } catch {
          return fb.value as unknown as T;
        }
      }
      try {
        return JSON.parse(val) as T;
      } catch {
        return val as unknown as T;
      }
    } catch {
      // Fallback to memory
      const fb = this.fallback.get(fullKey);
      if (!fb) return null;
      if (fb.expiresAt && fb.expiresAt < Date.now()) {
        this.fallback.delete(fullKey);
        return null;
      }
      try {
        return JSON.parse(fb.value) as T;
      } catch {
        return fb.value as unknown as T;
      }
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const fullKey = this.prefix + key;
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;

    // Always set in fallback
    this.fallback.set(fullKey, { value: serialized, expiresAt });

    try {
      if (ttlSeconds) {
        await this.redis.setex(fullKey, ttlSeconds, serialized);
      } else {
        await this.redis.set(fullKey, serialized);
      }
    } catch {
      // Ignore Redis errors, fallback already set
    }
  }

  async del(key: string): Promise<void> {
    const fullKey = this.prefix + key;
    this.fallback.delete(fullKey);
    try {
      await this.redis.del(fullKey);
    } catch {}
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.prefix + key;
    try {
      const res = await this.redis.exists(fullKey);
      if (res === 1) return true;
    } catch {}
    const fb = this.fallback.get(fullKey);
    if (!fb) return false;
    if (fb.expiresAt && fb.expiresAt < Date.now()) {
      this.fallback.delete(fullKey);
      return false;
    }
    return true;
  }
}

export class RedisRateLimiter {
  constructor(private redis: Redis) {}

  async isAllowed(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    try {
      const now = Date.now();
      const windowKey = `ratelimit:${key}:${Math.floor(now / 1000 / windowSeconds)}`;
      const count = await this.redis.incr(windowKey);
      if (count === 1) {
        await this.redis.expire(windowKey, windowSeconds);
      }
      const ttl = await this.redis.ttl(windowKey);
      const resetAt = now + ttl * 1000;
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt,
      };
    } catch {
      // Fail open if Redis unavailable
      return { allowed: true, remaining: limit, resetAt: Date.now() + windowSeconds * 1000 };
    }
  }
}

export class RedisDistributedLock {
  constructor(private redis: Redis) {}

  async acquire(key: string, ttlMs: number, value = "locked"): Promise<boolean> {
    try {
      const result = await this.redis.set(`lock:${key}`, value, "PX", ttlMs, "NX");
      return result === "OK";
    } catch {
      // Fail open for dev
      return true;
    }
  }

  async release(key: string): Promise<void> {
    try {
      await this.redis.del(`lock:${key}`);
    } catch {}
  }
}
