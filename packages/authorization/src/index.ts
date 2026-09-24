import { z } from "zod";
import type { Identity } from "@agentmesh/identity";
import { AuthorizationError } from "@agentmesh/core";

// Types

export const EffectSchema = z.enum(["allow", "deny"]);
export type Effect = z.infer<typeof EffectSchema>;

export const PolicySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  effect: EffectSchema,
  subjects: z.array(z.string()).default([]), // identity patterns, e.g., "user:*", "agent:code-agent", "org:123"
  resources: z.array(z.string()).default([]), // resource patterns, e.g., "agent:*", "task:*", "skill:code-review"
  actions: z.array(z.string()).default([]), // actions, e.g., "agent:register", "task:create", "skill:invoke"
  conditions: z.record(z.unknown()).default({}), // additional conditions
  isActive: z.boolean().default(true),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  priority: z.number().int().default(0), // higher priority evaluated first
});

export type Policy = z.infer<typeof PolicySchema>;

export interface AuthZRequest {
  identity?: Identity;
  resource: string; // e.g., "agent:abc", "task:xyz", "skill:code-review"
  action: string; // e.g., "agent:read", "task:create", "skill:invoke"
  context?: {
    organizationId?: string;
    projectId?: string;
    agentId?: string;
    skill?: string;
    taskId?: string;
    trustLevel?: string;
    delegationChain?: string[];
    [key: string]: unknown;
  };
}

export interface AuthZResult {
  allowed: boolean;
  reason?: string;
  matchedPolicy?: Policy;
  decision: "allow" | "deny" | "no_match";
}

export interface PolicyProvider {
  readonly name: string;
  listPolicies(filter?: {
    organizationId?: string;
    projectId?: string;
    isActive?: boolean;
  }): Promise<Policy[]>;
  getPolicy(id: string): Promise<Policy | null>;
}

// In-memory provider for Phase 3

export class InMemoryPolicyProvider implements PolicyProvider {
  readonly name = "inmemory";
  private policies = new Map<string, Policy>();

  constructor(initial: Policy[] = []) {
    for (const p of initial) this.policies.set(p.id, p);
  }

  addPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
  }

  async listPolicies(filter?: {
    organizationId?: string;
    projectId?: string;
    isActive?: boolean;
  }): Promise<Policy[]> {
    let list = Array.from(this.policies.values());
    if (filter?.organizationId)
      list = list.filter(p => !p.organizationId || p.organizationId === filter.organizationId);
    if (filter?.projectId)
      list = list.filter(p => !p.projectId || p.projectId === filter.projectId);
    if (filter?.isActive !== undefined) list = list.filter(p => p.isActive === filter.isActive);
    // Sort by priority desc
    list.sort((a, b) => b.priority - a.priority);
    return list;
  }

  async getPolicy(id: string): Promise<Policy | null> {
    return this.policies.get(id) ?? null;
  }
}

// Policy Engine

export class PolicyEngine {
  constructor(private provider: PolicyProvider) {}

  async evaluate(req: AuthZRequest): Promise<AuthZResult> {
    const policies = await this.provider.listPolicies({
      organizationId: req.context?.organizationId,
      projectId: req.context?.projectId,
      isActive: true,
    });

    // First, check for explicit deny (deny overrides allow)
    for (const policy of policies) {
      if (policy.effect === "deny" && this.matches(policy, req)) {
        return {
          allowed: false,
          reason: `Denied by policy ${policy.name} (${policy.id})`,
          matchedPolicy: policy,
          decision: "deny",
        };
      }
    }

    // Then check for allow
    for (const policy of policies) {
      if (policy.effect === "allow" && this.matches(policy, req)) {
        return {
          allowed: true,
          reason: `Allowed by policy ${policy.name} (${policy.id})`,
          matchedPolicy: policy,
          decision: "allow",
        };
      }
    }

    // No matching policy - default deny for security, but allow for development if no policies exist
    if (policies.length === 0) {
      return {
        allowed: true,
        reason: "No policies configured, default allow (dev mode)",
        decision: "no_match",
      };
    }

    return { allowed: false, reason: "No matching allow policy", decision: "no_match" };
  }

  async enforce(req: AuthZRequest): Promise<void> {
    const result = await this.evaluate(req);
    if (!result.allowed) {
      throw new AuthorizationError(result.reason ?? "Unauthorized");
    }
  }

  private matches(policy: Policy, req: AuthZRequest): boolean {
    // Check subject
    if (policy.subjects.length > 0) {
      const subjectMatch = policy.subjects.some(pattern =>
        this.matchPattern(pattern, this.identityToSubject(req.identity))
      );
      if (!subjectMatch) return false;
    }

    // Check resource
    if (policy.resources.length > 0) {
      const resourceMatch = policy.resources.some(pattern =>
        this.matchPattern(pattern, req.resource)
      );
      if (!resourceMatch) return false;
    }

    // Check action
    if (policy.actions.length > 0) {
      const actionMatch = policy.actions.some(pattern => this.matchPattern(pattern, req.action));
      if (!actionMatch) return false;
    }

    // Check conditions (simplified for Phase 3)
    if (policy.conditions && Object.keys(policy.conditions).length > 0) {
      if (!this.evaluateConditions(policy.conditions as any, req)) return false;
    }

    return true;
  }

  private identityToSubject(identity?: Identity): string {
    if (!identity) return "anonymous";
    return `${identity.type}:${identity.id}`;
  }

  private matchPattern(pattern: string, value: string): boolean {
    // Simple glob: * matches anything, prefix* matches prefix
    if (pattern === "*") return true;
    if (pattern.endsWith(":*")) {
      const prefix = pattern.slice(0, -2);
      return value.startsWith(prefix + ":") || value === prefix;
    }
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      return value.startsWith(prefix);
    }
    if (pattern.startsWith("*:")) {
      const suffix = pattern.slice(2);
      return value.endsWith(":" + suffix) || value.endsWith(suffix);
    }
    return pattern === value;
  }

  private evaluateConditions(conditions: Record<string, unknown>, req: AuthZRequest): boolean {
    // Phase 3: simple conditions - trustLevel, organizationId, etc.
    // Example: { trustLevel: ["VERIFIED", "ORGANIZATION"], organizationId: "org_123" }

    for (const [key, expected] of Object.entries(conditions)) {
      const actual = (req.context as any)?.[key] ?? (req.identity as any)?.[key];

      if (Array.isArray(expected)) {
        if (!expected.includes(actual)) return false;
      } else if (typeof expected === "object" && expected !== null) {
        // Handle operators like { $in: [...], $ne: ... } - simplified
        const ops = expected as any;
        if (ops.$in && !ops.$in.includes(actual)) return false;
        if (ops.$ne && ops.$ne === actual) return false;
        if (ops.$eq && ops.$eq !== actual) return false;
      } else {
        if (actual !== expected) return false;
      }
    }

    return true;
  }
}

// Default policies for development

export function createDefaultPolicies(): Policy[] {
  return [
    {
      id: "allow_all_dev",
      name: "Allow All (Dev)",
      description: "Allow all actions in development when no other policies",
      effect: "allow",
      subjects: ["*"],
      resources: ["*"],
      actions: ["*"],
      conditions: {},
      isActive: true,
      priority: -100, // lowest priority
    },
    {
      id: "deny_untrusted_prod_deploy",
      name: "Deny Untrusted Prod Deploy",
      description: "Untrusted agents cannot deploy to production",
      effect: "deny",
      subjects: ["*"],
      resources: ["environment:production", "skill:production.deploy"],
      actions: ["*"],
      conditions: { trustLevel: ["UNTRUSTED", "EXTERNAL"] },
      isActive: true,
      priority: 100,
    },
    {
      id: "allow_org_agents",
      name: "Allow Organization Agents",
      description: "Agents in same org can invoke each other",
      effect: "allow",
      subjects: ["agent:*"],
      resources: ["agent:*", "skill:*", "task:*"],
      actions: ["agent:read", "skill:invoke", "task:create", "task:read"],
      conditions: {},
      isActive: true,
      priority: 50,
    },
  ];
}

// Factory

export function createPolicyEngine(policies?: Policy[]): PolicyEngine {
  const provider = new InMemoryPolicyProvider(policies ?? createDefaultPolicies());
  return new PolicyEngine(provider);
}

// Delegation Authority

export interface Delegation {
  id: string;
  parentIdentity: Identity;
  delegatedTo: Identity;
  scopes: string[]; // e.g., ["research.read", "code-review"]
  audience: string; // who can use it
  expiration: string; // ISO
  purpose?: string;
  chain: string[]; // delegation chain IDs
  isRevoked: boolean;
}

export class DelegationManager {
  private delegations = new Map<string, Delegation>();

  createDelegation(
    input: Omit<Delegation, "id" | "isRevoked" | "chain"> & { chain?: string[] }
  ): Delegation {
    // Prevent privilege escalation - delegated scopes must be subset of parent's scopes
    const parentScopes = input.parentIdentity.scopes ?? [];
    if (parentScopes.length > 0) {
      const invalid = input.scopes.filter(
        s => !parentScopes.includes(s) && !parentScopes.includes("*")
      );
      if (invalid.length > 0) {
        throw new Error(`Privilege escalation: parent does not have scopes ${invalid.join(", ")}`);
      }
    }

    const delegation: Delegation = {
      id: `del_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      parentIdentity: input.parentIdentity,
      delegatedTo: input.delegatedTo,
      scopes: input.scopes,
      audience: input.audience,
      expiration: input.expiration,
      purpose: input.purpose,
      chain: [...(input.chain ?? []), input.parentIdentity.id],
      isRevoked: false,
    };

    this.delegations.set(delegation.id, delegation);
    return delegation;
  }

  revoke(id: string): void {
    const del = this.delegations.get(id);
    if (del) del.isRevoked = true;
  }

  verify(
    id: string,
    requiredScope?: string
  ): { valid: boolean; reason?: string; delegation?: Delegation } {
    const del = this.delegations.get(id);
    if (!del) return { valid: false, reason: "Delegation not found" };
    if (del.isRevoked) return { valid: false, reason: "Delegation revoked" };
    if (new Date(del.expiration).getTime() < Date.now())
      return { valid: false, reason: "Delegation expired" };
    if (requiredScope && !del.scopes.includes(requiredScope) && !del.scopes.includes("*")) {
      return { valid: false, reason: `Scope ${requiredScope} not in delegation` };
    }
    return { valid: true, delegation: del };
  }
}
