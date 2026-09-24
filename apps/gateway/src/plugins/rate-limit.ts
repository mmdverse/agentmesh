import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { createDefaultRateLimiter, type RateLimitContext } from "@agentmesh/rate-limit";

export interface RateLimitPluginOptions {
  enabled?: boolean;
}

async function rateLimitPluginInternal(app: FastifyInstance, opts: RateLimitPluginOptions = {}) {
  if (opts.enabled === false) {
    console.log("[rate-limit] disabled");
    return;
  }

  const limiter = createDefaultRateLimiter();

  if (!app.hasDecorator("rateLimiter")) {
    app.decorate("rateLimiter", limiter);
  }

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url.includes("/health") || req.url.includes("/ready")) return;

    const tenant = (req as any).tenant ?? {};
    const auth = (req as any).auth ?? {};

    const ctx: RateLimitContext = {
      organizationId: tenant.organizationId,
      projectId: tenant.projectId,
      identityId: auth.identity?.id,
      agentId: (req.params as any)?.id,
      skill: (req.query as any)?.skill ?? (req.body as any)?.skill,
      endpoint: req.routeOptions.url ?? req.url,
      ip: req.ip,
    };

    const result = await limiter.check(ctx);

    if (!result.allowed) {
      const retryAfter = result.result?.resetAt ? Math.ceil((result.result.resetAt - Date.now()) / 1000) : 60;
      reply.header("Retry-After", String(retryAfter));
      reply.header("X-RateLimit-Limit", String(result.limit?.limit ?? 0));
      reply.header("X-RateLimit-Remaining", "0");
      reply.header("X-RateLimit-Reset", String(result.result?.resetAt ?? Date.now() + 60000));
      return reply.status(429).send({
        error: { code: "RATE_LIMIT_EXCEEDED", message: result.reason ?? "Rate limit exceeded", retryAfter },
      });
    }

    if (result.result) {
      reply.header("X-RateLimit-Limit", String(result.limit?.limit ?? result.result.count ?? 0));
      reply.header("X-RateLimit-Remaining", String(result.result.remaining ?? 0));
      reply.header("X-RateLimit-Reset", String(result.result.resetAt ?? 0));
    }
  });
}

export const rateLimitPlugin = fp(rateLimitPluginInternal, { name: "rate-limit", fastify: "5.x" });

declare module "fastify" {
  interface FastifyInstance {
    rateLimiter: ReturnType<typeof createDefaultRateLimiter>;
  }
}
