import { getArtifactManager, InMemoryArtifactStore } from "@agentmesh/artifacts";
import type { ArtifactMetadata } from "@agentmesh/artifacts";
import { createEventBus, type AgentMeshEvent } from "@agentmesh/events";
import { ValidationError, NotFoundError } from "@agentmesh/core";
import type { TenantContext } from "@agentmesh/tenancy";
import { getTenantManager } from "@agentmesh/tenancy";

export class ArtifactService {
  private manager = getArtifactManager(new InMemoryArtifactStore());
  private eventBus = createEventBus({ serviceName: "control-plane-artifacts", url: process.env.NATS_URL });
  private tenantManager = getTenantManager();

  async create(input: {
    name?: string;
    description?: string;
    contentType: string;
    data: Buffer | Uint8Array | string;
    organizationId?: string;
    projectId?: string;
    taskId?: string;
    agentId?: string;
    createdBy?: string;
    retentionDays?: number;
    accessControl?: ArtifactMetadata["accessControl"];
    tags?: string[];
    tenant?: TenantContext;
  }): Promise<ArtifactMetadata> {
    if (input.tenant) {
      input.organizationId = input.organizationId ?? input.tenant.organizationId;
      input.projectId = input.projectId ?? input.tenant.projectId;
    }

    const artifact = await this.manager.createArtifact({
      name: input.name,
      description: input.description,
      contentType: input.contentType,
      data: input.data,
      organizationId: input.organizationId,
      projectId: input.projectId,
      taskId: input.taskId,
      agentId: input.agentId,
      createdBy: input.createdBy,
      retentionDays: input.retentionDays,
      accessControl: input.accessControl,
      tags: input.tags,
    });

    await this.publishEvent("artifact.created", artifact.id, { artifact }, input.tenant);

    return artifact;
  }

  async getById(id: string, tenant?: TenantContext): Promise<{ metadata: ArtifactMetadata; data: Buffer; contentType: string }> {
    const result = await this.manager.getArtifact(id, {
      organizationId: tenant?.organizationId,
      projectId: tenant?.projectId,
    });

    if (tenant && result.metadata.organizationId) {
      this.tenantManager.enforce(tenant, {
        organizationId: result.metadata.organizationId,
        projectId: result.metadata.projectId ?? undefined,
      });
    }

    return result;
  }

  async getMetadata(id: string, tenant?: TenantContext): Promise<ArtifactMetadata> {
    const meta = await this.manager.getMetadata(id);
    if (!meta) throw new NotFoundError("Artifact", id);

    if (tenant && meta.organizationId) {
      this.tenantManager.enforce(tenant, {
        organizationId: meta.organizationId,
        projectId: meta.projectId ?? undefined,
      });
    }

    return meta;
  }

  async list(filter: { organizationId?: string; projectId?: string; taskId?: string; agentId?: string; limit?: number; offset?: number; contentType?: string; tenant?: TenantContext }): Promise<{ artifacts: ArtifactMetadata[]; total: number }> {
    if (filter.tenant) {
      filter.organizationId = filter.organizationId ?? filter.tenant.organizationId;
      filter.projectId = filter.projectId ?? filter.tenant.projectId;
    }
    return this.manager.listArtifacts(filter);
  }

  async delete(id: string, tenant?: TenantContext): Promise<void> {
    const meta = await this.manager.getMetadata(id);
    if (!meta) throw new NotFoundError("Artifact", id);

    if (tenant && meta.organizationId) {
      this.tenantManager.enforce(tenant, {
        organizationId: meta.organizationId,
        projectId: meta.projectId ?? undefined,
      });
    }

    await this.manager.deleteArtifact(id, {
      organizationId: tenant?.organizationId,
      projectId: tenant?.projectId,
    });
  }

  async presignedUrl(id: string, tenant?: TenantContext): Promise<{ url: string; metadata: ArtifactMetadata }> {
    const meta = await this.manager.getMetadata(id);
    if (!meta) throw new NotFoundError("Artifact", id);

    if (tenant && meta.organizationId) {
      this.tenantManager.enforce(tenant, {
        organizationId: meta.organizationId,
        projectId: meta.projectId ?? undefined,
      });
    }

    return this.manager.presignedUrl(id);
  }

  private async publishEvent(type: AgentMeshEvent["type"], subject: string, data: unknown, tenant?: TenantContext): Promise<void> {
    try {
      const event: AgentMeshEvent = {
        id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        source: "control-plane",
        subject: `artifact.${subject}`,
        data,
        timestamp: new Date().toISOString(),
        organizationId: tenant?.organizationId,
        projectId: tenant?.projectId,
      };
      await this.eventBus.publish(event);
    } catch (err) {
      console.warn(`[artifacts] failed to publish event ${type}: ${(err as Error).message}`);
    }
  }
}

let instance: ArtifactService | null = null;
export function getArtifactService(): ArtifactService {
  if (!instance) instance = new ArtifactService();
  return instance;
}
