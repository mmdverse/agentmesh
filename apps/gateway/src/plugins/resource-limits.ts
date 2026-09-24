import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import {
  checkResourceLimits,
  type ResourceLimits,
  DEFAULT_RESOURCE_LIMITS,
} from "@agentmesh/rate-limit";

export interface ResourceLimitsPluginOptions {
  limits?: ResourceLimits;
}

async function resourceLimitsPluginInternal(
  app: FastifyInstance,
  opts: ResourceLimitsPluginOptions = {}
) {
  const limits = { ...DEFAULT_RESOURCE_LIMITS, ...opts.limits };

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    // Check content-length header
    const contentLength = req.headers["content-length"]
      ? parseInt(req.headers["content-length"] as string, 10)
      : 0;

    if (contentLength > limits.maxMessageSize) {
      return reply.status(413).send({
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: `Payload size ${contentLength} exceeds limit ${limits.maxMessageSize}`,
          limit: limits.maxMessageSize,
        },
      });
    }

    // Check fan-out header if present
    const fanOut = req.headers["x-fan-out"] ? parseInt(req.headers["x-fan-out"] as string, 10) : 0;
    if (fanOut > limits.maxFanOut) {
      return reply.status(400).send({
        error: {
          code: "FAN_OUT_EXCEEDED",
          message: `Fan-out ${fanOut} exceeds limit ${limits.maxFanOut}`,
          limit: limits.maxFanOut,
        },
      });
    }
  });

  app.addHook("preHandler", async (req: FastifyRequest, reply: FastifyReply) => {
    // For artifact uploads, check size
    if (req.url.includes("/artifacts") && req.method === "POST") {
      const body = req.body as any;
      if (body?.size && body.size > limits.maxArtifactSize) {
        return reply.status(413).send({
          error: {
            code: "ARTIFACT_TOO_LARGE",
            message: `Artifact size ${body.size} exceeds limit ${limits.maxArtifactSize}`,
            limit: limits.maxArtifactSize,
          },
        });
      }
    }
  });
}

export const resourceLimitsPlugin = fp(resourceLimitsPluginInternal, {
  name: "resource-limits",
  fastify: "5.x",
});
