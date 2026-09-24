import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface OIDCConfig {
  issuer: string;
  clientId?: string;
  clientSecret?: string;
  jwksUri?: string;
}

export interface VerifiedToken {
  payload: JWTPayload;
  identity: string;
  scopes?: string[];
}

export class OIDCVerifier {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
  private issuer: string;

  constructor(private config: OIDCConfig) {
    this.issuer = config.issuer;
    const jwksUri = config.jwksUri ?? `${config.issuer.replace(/\/$/, "")}/.well-known/jwks.json`;
    this.jwks = createRemoteJWKSet(new URL(jwksUri));
  }

  async verify(token: string): Promise<VerifiedToken> {
    if (!this.jwks) throw new Error("JWKS not initialized");
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.issuer,
      audience: this.config.clientId,
    });

    const identity = (payload.sub ?? payload.email ?? payload.preferred_username ?? "unknown") as string;
    const scopes = typeof payload.scope === "string" ? (payload.scope as string).split(" ") : (payload.scp as string[]) ?? [];

    return { payload, identity, scopes };
  }
}

// Simple API key verifier for Phase 0
export class ApiKeyVerifier {
  constructor(private validKeys: Set<string> | Map<string, { identity: string; scopes?: string[] }>) {}

  verify(apiKey: string): { identity: string; scopes?: string[] } | null {
    if (this.validKeys instanceof Set) {
      if (this.validKeys.has(apiKey)) return { identity: `apikey:${apiKey.substring(0, 8)}` };
      return null;
    } else {
      return this.validKeys.get(apiKey) ?? null;
    }
  }
}

export function createOIDCVerifier(config: OIDCConfig): OIDCVerifier {
  return new OIDCVerifier(config);
}
