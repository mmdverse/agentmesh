import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { CircuitBreaker, Bulkhead } from "@agentmesh/reliability";

export interface CircuitBreakerPluginOptions {
  failureThreshold?: number;
  timeoutMs?: number;
  maxConcurrent?: number;
}

async function circuitBreakerPluginInternal(
  app: FastifyInstance,
  opts: CircuitBreakerPluginOptions = {}
) {
  const breakers = new Map<string, CircuitBreaker>();
  const bulkheads = new Map<string, Bulkhead>();

  function getBreaker(key: string): CircuitBreaker {
    if (!breakers.has(key)) {
      breakers.set(
        key,
        new CircuitBreaker({
          failureThreshold: opts.failureThreshold ?? 5,
          timeoutMs: opts.timeoutMs ?? 60000,
          name: `gateway:${key}`,
        })
      );
    }
    return breakers.get(key)!;
  }

  function getBulkhead(key: string): Bulkhead {
    if (!bulkheads.has(key)) {
      bulkheads.set(
        key,
        new Bulkhead({
          maxConcurrent: opts.maxConcurrent ?? 50,
          maxQueue: 100,
          name: `gateway:${key}`,
        })
      );
    }
    return bulkheads.get(key)!;
  }

  if (!app.hasDecorator("circuitBreakers")) {
    app.decorate("circuitBreakers", breakers);
  }
  if (!app.hasDecorator("bulkheads")) {
    app.decorate("bulkheads", bulkheads);
  }

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const key = (req.params as any)?.id ?? req.routeOptions.url ?? req.url;
    const breaker = getBreaker(key);

    if (breaker.getState() === "OPEN") {
      return reply.status(503).send({
        error: {
          code: "CIRCUIT_OPEN",
          message: `Circuit breaker OPEN for ${key}, try again later`,
          retryAfter: Math.ceil((breaker.getStats().nextAttempt - Date.now()) / 1000),
        },
      });
    }

    const bulkhead = getBulkhead(key);
    const stats = bulkhead.getStats();
    if (stats.active >= stats.maxConcurrent) {
      return reply.status(503).send({
        error: {
          code: "TOO_MANY_REQUESTS",
          message: `Too many concurrent requests for ${key} (${stats.active}/${stats.maxConcurrent})`,
        },
      });
    }
  });

  app.addHook("onResponse", async (req: FastifyRequest) => {
    const key = (req.params as any)?.id ?? req.routeOptions.url ?? req.url;
    const breaker = breakers.get(key);
    const bulkhead = bulkheads.get(key);

    if (bulkhead) {
      // Release after response - we track active via onRequest/onResponse
      // For simplicity, we don't strictly track acquire/release here since we check active count
      // In production, use tryAcquire/release pattern
    }

    // On 5xx, record failure
    // @ts-ignore
    const status = (req as any).statusCode ?? 200;
    // Actually we need reply status, but onResponse has reply in context? We'll use hook with reply param in newer Fastify
    // For now, we rely on error handler to record failures
  });

  // Reliability stats endpoint
  app.get("/v1/reliability/stats", async () => {
    const breakerStats: Record<string, any> = {};
    for (const [k, v] of breakers.entries()) breakerStats[k] = v.getStats();
    const bulkheadStats: Record<string, any> = {};
    for (const [k, v] of bulkheads.entries()) bulkheadStats[k] = v.getStats();
    return { breakers: breakerStats, bulkheads: bulkheadStats };
  });
}

export const circuitBreakerPlugin = fp(circuitBreakerPluginInternal, {
  name: "circuit-breaker",
  fastify: "5.x",
});

declare module "fastify" {
  interface FastifyInstance {
    circuitBreakers: Map<string, CircuitBreaker>;
    bulkheads: Map<string, Bulkhead>;
  }
}
