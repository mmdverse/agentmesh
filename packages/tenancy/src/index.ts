/**
 * Tenancy - Multi-tenancy subsystem for AgentMesh
 * Organization -> Projects -> Agents/Tasks/Policies/Credentials
 * Strict Tenant Isolation
 */

import { z } from "zod";
import { AuthorizationError, ValidationError } from "@agentmesh/core";

export const TenantContextSchema = z.object({
  organizationId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  // For hierarchical checks
  organizationSlug: z.string().optional(),
  projectSlug: z.string().optional(),
});

export type TenantContext = z.infer<typeof TenantContextSchema>;

export interface TenantIsolationOptions {
  requireOrganization: boolean;
  requireProject: boolean;
  allowCrossProject: boolean; // within same org, can projects access each other?
  allowCrossOrganization: boolean; // super admin?
  superAdminIdentities?: string[]; // identities that can bypass isolation
}

export const DEFAULT_TENANT_OPTIONS: TenantIsolationOptions = {
  requireOrganization: false, // for dev, allow no org; in prod, set true
  requireProject: false,
  allowCrossProject: false,
  allowCrossOrganization: false,
};

export class TenantManager {
  constructor(private options: TenantIsolationOptions = DEFAULT_TENANT_OPTIONS) {}

  validateContext(ctx: TenantContext): void {
    if (this.options.requireOrganization && !ctx.organizationId) {
      throw new ValidationError("organizationId is required");
    }
    if (this.options.requireProject && !ctx.projectId) {
      throw new ValidationError("projectId is required");
    }
  }

  // Check if identity with tenant ctx can access resource with resource tenant
  canAccess(
    accessorTenant: TenantContext,
    resourceTenant: TenantContext,
    accessorIdentity?: { id: string; type: string }
  ): { allowed: boolean; reason?: string } {
    // Super admin bypass
    if (
      accessorIdentity &&
      this.options.superAdminIdentities?.includes(accessorIdentity.id)
    ) {
      return { allowed: true };
    }

    // If no resource tenant, allow (public resource or legacy)
    if (!resourceTenant.organizationId && !resourceTenant.projectId) {
      return { allowed: true };
    }

    // If accessor has no tenant but resource does, deny unless allowCrossOrganization
    if (!accessorTenant.organizationId && resourceTenant.organizationId) {
      if (this.options.allowCrossOrganization) return { allowed: true };
      return { allowed: false, reason: "Accessor has no organization, resource is organization-scoped" };
    }

    // Organization check
    if (resourceTenant.organizationId) {
      if (accessorTenant.organizationId !== resourceTenant.organizationId) {
        if (this.options.allowCrossOrganization) return { allowed: true };
        return {
          allowed: false,
          reason: `Organization mismatch: accessor ${accessorTenant.organizationId} vs resource ${resourceTenant.organizationId}`,
        };
      }
    }

    // Project check
    if (resourceTenant.projectId) {
      if (!accessorTenant.projectId) {
        if (this.options.allowCrossProject) return { allowed: true };
        return { allowed: false, reason: "Accessor has no project, resource is project-scoped" };
      }
      if (accessorTenant.projectId !== resourceTenant.projectId) {
        if (this.options.allowCrossProject) return { allowed: true };
        return {
          allowed: false,
          reason: `Project mismatch: accessor ${accessorTenant.projectId} vs resource ${resourceTenant.projectId}`,
        };
      }
    }

    return { allowed: true };
  }

  enforce(
    accessorTenant: TenantContext,
    resourceTenant: TenantContext,
    accessorIdentity?: { id: string; type: string }
  ): void {
    const result = this.canAccess(accessorTenant, resourceTenant, accessorIdentity);
    if (!result.allowed) {
      throw new AuthorizationError(result.reason ?? "Tenant isolation violation");
    }
  }

  // Filter list by tenant - returns filter for DB query
  getTenantFilter(ctx: TenantContext): { organizationId?: string; projectId?: string } {
    return {
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
    };
  }

  // For registry listing: if strict isolation, must filter
  shouldEnforceIsolation(ctx: TenantContext): boolean {
    return !!(ctx.organizationId || ctx.projectId);
  }

  // Extract tenant from request headers/body/query
  extractFromRequest(req: {
    headers?: Record<string, string | undefined>;
    query?: Record<string, string | undefined>;
    body?: Record<string, unknown>;
    auth?: { identity?: { organizationId?: string; projectId?: string } };
  }): TenantContext {
    const headers = req.headers ?? {};
    const query = req.query ?? {};
    const body = req.body ?? {};

    const organizationId =
      headers["x-organization-id"] ??
      headers["x-org-id"] ??
      query["organizationId"] ??
      (body["organizationId"] as string) ??
      req.auth?.identity?.organizationId;

    const projectId =
      headers["x-project-id"] ??
      query["projectId"] ??
      (body["projectId"] as string) ??
      req.auth?.identity?.projectId;

    return {
      organizationId: organizationId as string | undefined,
      projectId: projectId as string | undefined,
    };
  }
}

// For multi-tenancy hierarchy validation
export interface Organization {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  createdAt: string;
}

export class InMemoryTenantStore {
  private orgs = new Map<string, Organization>();
  private projects = new Map<string, Project>();

  createOrganization(org: Organization): Organization {
    this.orgs.set(org.id, org);
    return org;
  }

  getOrganization(id: string): Organization | null {
    return this.orgs.get(id) ?? null;
  }

  createProject(proj: Project): Project {
    if (!this.orgs.has(proj.organizationId)) {
      throw new ValidationError(`Organization ${proj.organizationId} not found`);
    }
    this.projects.set(proj.id, proj);
    return proj;
  }

  getProject(id: string): Project | null {
    return this.projects.get(id) ?? null;
  }

  listProjects(orgId: string): Project[] {
    return Array.from(this.projects.values()).filter((p) => p.organizationId === orgId);
  }

  validateHierarchy(orgId?: string, projectId?: string): void {
    if (projectId) {
      const proj = this.projects.get(projectId);
      if (!proj) throw new ValidationError(`Project ${projectId} not found`);
      if (orgId && proj.organizationId !== orgId) {
        throw new ValidationError(`Project ${projectId} does not belong to organization ${orgId}`);
      }
    }
    if (orgId) {
      if (!this.orgs.has(orgId)) throw new ValidationError(`Organization ${orgId} not found`);
    }
  }
}

let defaultManager: TenantManager | null = null;

export function getTenantManager(): TenantManager {
  if (!defaultManager) defaultManager = new TenantManager();
  return defaultManager;
}

export function createTenantManager(opts?: Partial<TenantIsolationOptions>): TenantManager {
  return new TenantManager({ ...DEFAULT_TENANT_OPTIONS, ...opts });
}
