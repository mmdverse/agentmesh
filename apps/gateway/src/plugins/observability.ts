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
        "http.route": req.routeOptions.url ?? req.url,
        "service.name": opts.serviceName ?? "gateway",
        "tenant.organization": (req as any).tenant?.organizationId,
        "tenant.project": (req as any).tenant?.projectId,
      },
    });

    (req as any).traceId = traceId;
    (req as any).spanId = span.id;
    (req as any).traceSpan = span;
  });

  app.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
    const spanId = (req as any).spanId;
    if (spanId) {
      obs.endSpan(spanId, {
        attributes: {
          "http.status_code": reply.statusCode,
          "http.duration_ms": Date.now() - (obs["tracer"].getSpan(spanId)?.startTime ?? Date.now()),
        },
      });

      // Record metrics
      obs.recordAgentMetrics("gateway", {
        latencyMs: Date.now() - (obs["tracer"].getSpan(spanId)?.startTime ?? Date.now()),
        error: reply.statusCode >= 500,
      });
    }
  });

  app.addHook("onError", async (req: FastifyRequest, _reply: FastifyReply, error: Error) => {
    const spanId = (req as any).spanId;
    if (spanId) {
      obs["tracer"].addEvent(spanId, "error", { message: error.message, stack: error.stack });
      obs.endSpan(spanId, { error });
    }
  });
}

export const observabilityPlugin = fp(observabilityPluginInternal, { name: "observability", fastify: "5.x" });

declare module "fastify" {
  interface FastifyInstance {
    observability: ReturnType<typeof getObservability>;
  }
  interface FastifyRequest {
    spanId: string;
    traceSpan: any;
  }
}
