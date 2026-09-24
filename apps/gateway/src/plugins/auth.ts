import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { createAuthProvider, type AuthContext, type ApiKeyRecord } from "@agentmesh/identity";

export interface AuthPluginOptions {
  jwtSecret?: string;
  oidcIssuer?: string;
  oidcClientId?: string;
  apiKeys?: ApiKeyRecord[];
  publicRoutes?: string[];
}

async function authPluginInternal(app: FastifyInstance, opts: AuthPluginOptions) {
  const authProvider = createAuthProvider({
    jwtSecret: opts.jwtSecret ?? process.env.JWT_SECRET,
    oidcIssuer: opts.oidcIssuer ?? process.env.OIDC_ISSUER,
    oidcClientId: opts.oidcClientId ?? process.env.OIDC_CLIENT_ID,
    apiKeys: opts.apiKeys,
  });

  const publicRoutes = new Set(
    opts.publicRoutes ?? ["/health", "/ready", "/v1/health", "/v1/info"]
  );

  if (!app.hasDecorator("authProvider")) {
    app.decorate("authProvider", authProvider);
  }

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (publicRoutes.has(req.url) || publicRoutes.has(req.routeOptions.url ?? "")) {
      (req as any).auth = { method: "none", authenticated: false } as AuthContext;
      return;
    }

    const authHeader = req.headers["authorization"] as string | undefined;
    const apiKeyHeader = req.headers["x-api-key"] as string | undefined;

    if (!authHeader && !apiKeyHeader) {
      if (process.env.NODE_ENV !== "production") {
        (req as any).auth = {
          method: "none",
          authenticated: false,
          identity: { id: "anonymous", type: "user", scopes: ["*"] },
        } as AuthContext;
        return;
      }
      (req as any).auth = { method: "none", authenticated: false } as AuthContext;
      return;
    }

    try {
      const auth = await authProvider.authenticate({ headers: req.headers as any });
      (req as any).auth = auth;
      if (!auth.authenticated && (authHeader || apiKeyHeader)) {
        return reply.status(401).send({
          error: { code: "AUTHENTICATION_FAILED", message: "Invalid authentication credentials" },
        });
      }
    } catch (err) {
      const e = err as any;
      if (e.statusCode === 401) {
        return reply
          .status(401)
          .send({ error: { code: e.code ?? "AUTHENTICATION_FAILED", message: e.message } });
      }
      app.log.warn({ err, url: req.url }, "auth error");
      (req as any).auth = { method: "none", authenticated: false } as AuthContext;
    }
  });
}

export const authPlugin = fp(authPluginInternal, { name: "auth", fastify: "5.x" });

declare module "fastify" {
  interface FastifyInstance {
    authProvider: ReturnType<typeof createAuthProvider>;
  }
  interface FastifyRequest {
    auth: AuthContext;
  }
}
