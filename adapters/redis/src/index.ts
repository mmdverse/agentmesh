import { Redis, type RedisOptions } from "ioredis";

let redisInstance: Redis | null = null;

export interface RedisConfig {
  url: string;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
}

export function createRedisClient(config: RedisConfig): Redis {
  const opts: RedisOptions = {
    maxRetriesPerRequest: config.maxRetriesPerRequest ?? 3,
    enableReadyCheck: true,
    lazyConnect: false,
  };

  if (config.keyPrefix) opts.keyPrefix = config.keyPrefix;

  const client = config.url.startsWith("redis://") || config.url.startsWith("rediss://") ? new Redis(config.url, opts) : new Redis({ ...opts, host: config.url });

  client.on("connect", () => console.log("[redis] connected"));
  client.on("error", (err: any) => console.error("[redis] error", err));
  client.on("close", () => console.log("[redis] closed"));

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
    await redisInstance.quit();
    redisInstance = null;
  }
}

// Helpers

export class RedisCache {
  constructor(private redis: Redis, private prefix = "cache:") {}

  async get<T>(key: string): Promise<T | null> {
    const val = await this.redis.get(this.prefix + key);
    if (!val) return null;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.redis.setex(this.prefix + key, ttlSeconds, serialized);
    } else {
      await this.redis.set(this.prefix + key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(this.prefix + key);
  }

  async exists(key: string): Promise<boolean> {
    const res = await this.redis.exists(this.prefix + key);
    return res === 1;
  }
}

export class RedisRateLimiter {
  constructor(private redis: Redis) {}

  async isAllowed(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
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
  }
}

export class RedisDistributedLock {
  constructor(private redis: Redis) {}

  async acquire(key: string, ttlMs: number, value = "locked"): Promise<boolean> {
    const result = await this.redis.set(`lock:${key}`, value, "PX", ttlMs, "NX");
    return result === "OK";
  }

  async release(key: string): Promise<void> {
    await this.redis.del(`lock:${key}`);
  }
}
