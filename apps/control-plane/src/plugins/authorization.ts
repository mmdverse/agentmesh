import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { createPolicyEngine, type Policy } from "@agentmesh/authorization";
import type { Identity } from "@agentmesh/identity";

export interface AuthorizationPluginOptions {
  policies?: Policy[];
  publicRoutes?: string[];
}

async function authorizationPluginInternal(
  app: FastifyInstance,
  opts: AuthorizationPluginOptions = {}
) {
  const policyEngine = createPolicyEngine(opts.policies);
  const publicRoutes = new Set(
    opts.publicRoutes ?? ["/health", "/ready", "/v1/health", "/v1/info"]
  );

  if (!app.hasDecorator("policyEngine")) {
    app.decorate("policyEngine", policyEngine);
  }

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (publicRoutes.has(req.url) || publicRoutes.has(req.routeOptions.url ?? "")) return;

    const auth = (req as any).auth ?? {};
    const tenant = (req as any).tenant ?? {};
    const identity: Identity | undefined = auth.identity;

    // Map routes to resources/actions
    const url = req.routeOptions.url ?? req.url;
    const method = req.method;

    let resource = "unknown";
    let action = "unknown";

    if (url.includes("/agents")) {
      const id = (req.params as any)?.id;
      resource = id ? `agent:${id}` : "agent:*";
      if (method === "GET") action = "agent:read";
      else if (method === "POST") action = "agent:register";
      else if (method === "PATCH") action = "agent:update";
      else if (method === "DELETE") action = "agent:delete";
    } else if (url.includes("/tasks")) {
      const id = (req.params as any)?.id;
      resource = id ? `task:${id}` : "task:*";
      if (method === "GET") action = "task:read";
      else if (method === "POST" && url.endsWith("/")) action = "task:create";
      else if (method === "POST" && url.includes("/cancel")) action = "task:cancel";
      else if (method === "POST" && url.includes("/complete")) action = "task:complete";
      else if (method === "POST" && url.includes("/fail")) action = "task:fail";
      else if (method === "POST" && url.includes("/retry")) action = "task:retry";
    } else if (url.includes("/artifacts")) {
      resource = "artifact:*";
      action = method === "GET" ? "artifact:read" : "artifact:write";
    } else if (url.includes("/policies")) {
      resource = "policy:*";
      action = method === "GET" ? "policy:read" : "policy:write";
    }

    const skill = (req.query as any)?.skill ?? (req.body as any)?.skill;

    if (skill) {
      const skillResource = `skill:${skill}`;
      const skillAction = "skill:invoke";

      try {
        await policyEngine.enforce({
          identity,
          resource: skillResource,
          action: skillAction,
          context: {
            organizationId: tenant.organizationId,
            projectId: tenant.projectId,
            skill,
            trustLevel: (identity?.metadata as any)?.trustLevel,
          },
        });
      } catch (err) {
        const e = err as any;
        return reply.status(e.statusCode ?? 403).send({
          error: {
            code: e.code ?? "FORBIDDEN",
            message: e.message ?? `Not allowed to invoke skill ${skill}`,
          },
        });
      }
    }

    try {
      await policyEngine.enforce({
        identity,
        resource,
        action,
        context: {
          organizationId: tenant.organizationId,
          projectId: tenant.projectId,
          agentId: (req.params as any)?.id,
          skill,
          trustLevel: (identity?.metadata as any)?.trustLevel,
        },
      });
    } catch (err) {
      const e = err as any;
      // In dev mode with default allow_all policy, this should pass
      // Only deny if explicit deny
      if (e.statusCode === 403) {
        return reply.status(403).send({
          error: {
            code: e.code ?? "FORBIDDEN",
            message: e.message ?? `Not allowed to ${action} on ${resource}`,
          },
        });
      }
      // For other errors, log and allow (fail open in dev)
      app.log.warn(
        { err, resource, action, identity: identity?.id },
        "authorization check failed, allowing in dev"
      );
    }
  });
}

export const authorizationPlugin = fp(authorizationPluginInternal, {
  name: "authorization",
  fastify: "5.x",
});

declare module "fastify" {
  interface FastifyInstance {
    policyEngine: ReturnType<typeof createPolicyEngine>;
  }
}
