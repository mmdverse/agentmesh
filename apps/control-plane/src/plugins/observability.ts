import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { getObservability } from "@agentmesh/observability";

export interface ObservabilityPluginOptions {
  serviceName?: string;
}

async function observabilityPluginInternal(app: FastifyInstance, opts: ObservabilityPluginOptions = {}) {
  const obs = getObservability();

  if (!app.hasDecorator("observability")) {
    app.decorate("observability", obs);
  }

  app.addHook("onRequest", async (req: FastifyRequest) => {
    const traceId = (req.headers["x-trace-id"] as string) ?? `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const span = obs["tracer"].startSpan(`http.${req.method} ${req.url}`, {
      traceId,
      kind: "server",
      attributes: {
        "http.method": req.method,
        "http.url": req.url,
        "service.name": opts.serviceName ?? "control-plane",
        "tenant.organization": (req as any).tenant?.organizationId,
      },
    });

    (req as any).traceId = traceId;
    (req as any).spanId = span.id;
  });

  app.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
    const spanId = (req as any).spanId;
    if (spanId) {
      obs.endSpan(spanId, {
        attributes: { "http.status_code": reply.statusCode },
      });
    }
  });
}

export const observabilityPlugin = fp(observabilityPluginInternal, { name: "observability", fastify: "5.x" });

declare module "fastify" {
  interface FastifyInstance {
    observability: ReturnType<typeof getObservability>;
  }
}
