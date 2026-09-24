import { z } from "zod";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { AuthenticationError } from "@agentmesh/core";

// Types

export interface Identity {
  id: string;
  type: "user" | "agent" | "service" | "system";
  organizationId?: string;
  projectId?: string;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export interface AuthContext {
  identity?: Identity;
  token?: string;
  apiKey?: string;
  method: "none" | "apiKey" | "jwt" | "oidc" | "mtls" | "workload";
  authenticated: boolean;
}

export interface AuthProvider {
  readonly name: string;
  authenticate(req: { headers: Record<string, string>; tls?: { clientCert?: string; subject?: string } }): Promise<AuthContext>;
}

// API Key Provider

export interface ApiKeyRecord {
  key: string;
  identity: Identity;
  expiresAt?: string;
  isActive: boolean;
}

export class ApiKeyProvider implements AuthProvider {
  readonly name = "apiKey";
  private keys: Map<string, ApiKeyRecord>;

  constructor(keys: ApiKeyRecord[] = []) {
    this.keys = new Map(keys.map((k) => [k.key, k]));
  }

  addKey(record: ApiKeyRecord): void {
    this.keys.set(record.key, record);
  }

  async authenticate(req: { headers: Record<string, string> }): Promise<AuthContext> {
    const authHeader = req.headers["authorization"] ?? req.headers["Authorization"] ?? "";
    const apiKeyHeader = req.headers["x-api-key"] ?? req.headers["X-API-Key"] ?? "";

    let key: string | null = null;

    if (apiKeyHeader) key = apiKeyHeader;
    else if (authHeader.startsWith("Bearer ")) key = authHeader.slice(7);
    else if (authHeader.startsWith("ApiKey ")) key = authHeader.slice(7);

    if (!key) {
      return { method: "none", authenticated: false };
    }

    const record = this.keys.get(key);
    if (!record) {
      throw new AuthenticationError("Invalid API key");
    }

    if (!record.isActive) {
      throw new AuthenticationError("API key is deactivated");
    }

    if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
      throw new AuthenticationError("API key expired");
    }

    return {
      method: "apiKey",
      authenticated: true,
      apiKey: key,
      identity: record.identity,
    };
  }
}

// JWT Provider (local verification)

export interface JWTProviderConfig {
  secret?: string; // HS256 secret
  issuer?: string;
  audience?: string;
}

export class JWTProvider implements AuthProvider {
  readonly name = "jwt";

  constructor(private config: JWTProviderConfig) {}

  async authenticate(req: { headers: Record<string, string> }): Promise<AuthContext> {
    const authHeader = req.headers["authorization"] ?? req.headers["Authorization"] ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return { method: "none", authenticated: false };
    }

    const token = authHeader.slice(7);
    if (!token) return { method: "none", authenticated: false };

    try {
      // If secret provided, verify HS256
      if (this.config.secret) {
        const { jwtVerify: verify } = await import("jose");
        const secret = new TextEncoder().encode(this.config.secret);
        const { payload } = await verify(token, secret, {
          issuer: this.config.issuer,
          audience: this.config.audience,
        });

        const identity = this.payloadToIdentity(payload);
        return { method: "jwt", authenticated: true, token, identity };
      }

      // Otherwise, decode without verification (for dev) - but warn
      console.warn("[identity:jwt] No secret configured, skipping verification (dev only)");
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT format");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      const identity = this.payloadToIdentity(payload as JWTPayload);
      return { method: "jwt", authenticated: true, token, identity };
    } catch (err) {
      throw new AuthenticationError(`JWT verification failed: ${(err as Error).message}`);
    }
  }

  private payloadToIdentity(payload: JWTPayload): Identity {
    return {
      id: (payload.sub as string) ?? (payload.email as string) ?? "unknown",
      type: (payload.type as any) ?? "user",
      organizationId: payload.org as string,
      projectId: payload.project as string,
      scopes: typeof payload.scope === "string" ? (payload.scope as string).split(" ") : (payload.scp as string[]) ?? [],
      metadata: { ...payload },
    };
  }
}

// OIDC Provider (remote JWKS)

export interface OIDCProviderConfig {
  issuer: string;
  clientId?: string;
  jwksUri?: string;
}

export class OIDCProvider implements AuthProvider {
  readonly name = "oidc";
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private config: OIDCProviderConfig) {
    const jwksUri = config.jwksUri ?? `${config.issuer.replace(/\/$/, "")}/.well-known/jwks.json`;
    try {
      this.jwks = createRemoteJWKSet(new URL(jwksUri));
    } catch (err) {
      console.warn(`[identity:oidc] Failed to create JWKS: ${(err as Error).message}`);
    }
  }

  async authenticate(req: { headers: Record<string, string> }): Promise<AuthContext> {
    const authHeader = req.headers["authorization"] ?? req.headers["Authorization"] ?? "";
    if (!authHeader.startsWith("Bearer ")) return { method: "none", authenticated: false };

    const token = authHeader.slice(7);
    if (!this.jwks) throw new AuthenticationError("OIDC JWKS not initialized");

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.config.issuer,
        audience: this.config.clientId,
      });

      const identity: Identity = {
        id: (payload.sub as string) ?? "unknown",
        type: "user",
        organizationId: payload.org as string,
        projectId: payload.project as string,
        scopes: typeof payload.scope === "string" ? (payload.scope as string).split(" ") : (payload.scp as string[]) ?? [],
        metadata: { ...payload },
      };

      return { method: "oidc", authenticated: true, token, identity };
    } catch (err) {
      throw new AuthenticationError(`OIDC verification failed: ${(err as Error).message}`);
    }
  }
}

// mTLS Provider

export class MTLSProvider implements AuthProvider {
  readonly name = "mtls";

  async authenticate(req: { headers: Record<string, string>; tls?: { clientCert?: string; subject?: string } }): Promise<AuthContext> {
    const cert = req.tls?.clientCert;
    const subject = req.tls?.subject;

    if (!cert || !subject) {
      return { method: "none", authenticated: false };
    }

    // Parse subject to extract identity - simplified for Phase 3
    // In production, verify cert chain, check CA, etc.
    const cnMatch = subject.match(/CN=([^,]+)/);
    const cn = cnMatch?.[1] ?? subject;

    const identity: Identity = {
      id: cn,
      type: "agent",
      metadata: { subject, certFingerprint: "TODO" },
    };

    return { method: "mtls", authenticated: true, identity };
  }
}

// Workload Identity Provider (e.g., Kubernetes Service Account, GCP, AWS)

export class WorkloadIdentityProvider implements AuthProvider {
  readonly name = "workload";

  async authenticate(req: { headers: Record<string, string> }): Promise<AuthContext> {
    const workloadHeader = req.headers["x-workload-identity"] ?? req.headers["x-service-account"] ?? "";
    if (!workloadHeader) return { method: "none", authenticated: false };

    // Simplified - in production verify token via metadata server
    const identity: Identity = {
      id: workloadHeader,
      type: "service",
      metadata: { workload: workloadHeader },
    };

    return { method: "workload", authenticated: true, identity };
  }
}

// Composite Provider - tries multiple providers in order

export class CompositeAuthProvider implements AuthProvider {
  readonly name = "composite";
  private providers: AuthProvider[] = [];

  constructor(providers: AuthProvider[] = []) {
    this.providers = providers;
  }

  addProvider(provider: AuthProvider): void {
    this.providers.push(provider);
  }

  async authenticate(req: { headers: Record<string, string>; tls?: any }): Promise<AuthContext> {
    for (const provider of this.providers) {
      try {
        const result = await provider.authenticate(req as any);
        if (result.authenticated) {
          return result;
        }
      } catch (err) {
        // If provider throws AuthenticationError, it means token was present but invalid - fail fast
        if (err instanceof AuthenticationError) throw err;
        console.warn(`[identity] provider ${provider.name} failed: ${(err as Error).message}`);
      }
    }

    return { method: "none", authenticated: false };
  }
}

// Factory

export function createAuthProvider(config: {
  jwtSecret?: string;
  oidcIssuer?: string;
  oidcClientId?: string;
  apiKeys?: ApiKeyRecord[];
}): AuthProvider {
  const composite = new CompositeAuthProvider();

  // API Keys first (fastest)
  if (config.apiKeys?.length) {
    composite.addProvider(new ApiKeyProvider(config.apiKeys));
  }

  // JWT
  if (config.jwtSecret) {
    composite.addProvider(new JWTProvider({ secret: config.jwtSecret }));
  }

  // OIDC
  if (config.oidcIssuer) {
    composite.addProvider(new OIDCProvider({ issuer: config.oidcIssuer, clientId: config.oidcClientId }));
  }

  // mTLS and Workload (always added, they check for presence)
  composite.addProvider(new MTLSProvider());
  composite.addProvider(new WorkloadIdentityProvider());

  return composite;
}

// Helpers

export function extractTenantFromIdentity(identity?: Identity): { organizationId?: string; projectId?: string } {
  if (!identity) return {};
  return {
    organizationId: identity.organizationId,
    projectId: identity.projectId,
  };
}
