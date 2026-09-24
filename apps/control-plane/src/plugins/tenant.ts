import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { createTenantManager, type TenantContext } from "@agentmesh/tenancy";

export interface TenantPluginOptions {
  requireOrganization?: boolean;
  requireProject?: boolean;
}

async function tenantPluginInternal(app: FastifyInstance, opts: TenantPluginOptions = {}) {
  const tenantManager = createTenantManager({
    requireOrganization: opts.requireOrganization ?? false,
    requireProject: opts.requireProject ?? false,
  });

  if (!app.hasDecorator("tenantManager")) {
    app.decorate("tenantManager", tenantManager);
  }

  app.addHook("onRequest", async (req: FastifyRequest) => {
    const headers = req.headers as Record<string, string | undefined>;
    const query = req.query as Record<string, string | undefined> | undefined;
    const body = req.body as Record<string, unknown> | undefined;

    const tenant = tenantManager.extractFromRequest({
      headers,
      query,
      body,
      auth: (req as any).auth,
    });

    (req as any).tenant = tenant;
  });
}

export const tenantPlugin = fp(tenantPluginInternal, { name: "tenant", fastify: "5.x" });

declare module "fastify" {
  interface FastifyInstance {
    tenantManager: ReturnType<typeof createTenantManager>;
  }
  interface FastifyRequest {
    tenant: TenantContext;
  }
}
