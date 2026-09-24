import { getWebhookManager, type WebhookEndpoint, type WebhookDelivery } from "@agentmesh/webhooks";
import { getTenantManager, type TenantContext } from "@agentmesh/tenancy";
import { NotFoundError, ValidationError } from "@agentmesh/core";

export class WebhookService {
  private manager = getWebhookManager();
  private tenantManager = getTenantManager();

  async register(input: { url: string; events?: string[]; organizationId?: string; projectId?: string; headers?: Record<string, string>; secret?: string; tenant?: TenantContext }): Promise<WebhookEndpoint> {
    if (input.tenant) {
      input.organizationId = input.organizationId ?? input.tenant.organizationId;
      input.projectId = input.projectId ?? input.tenant.projectId;
    }

    if (!input.url) throw new ValidationError("url is required");

    return this.manager.registerEndpoint({
      url: input.url,
      events: input.events,
      organizationId: input.organizationId,
      projectId: input.projectId,
      headers: input.headers,
      secret: input.secret,
    });
  }

  async list(filter: { organizationId?: string; projectId?: string; tenant?: TenantContext }): Promise<WebhookEndpoint[]> {
    if (filter.tenant) {
      filter.organizationId = filter.organizationId ?? filter.tenant.organizationId;
      filter.projectId = filter.projectId ?? filter.tenant.projectId;
    }
    return this.manager.listEndpoints(filter);
  }

  async delete(id: string, tenant?: TenantContext): Promise<void> {
    const endpoints = await this.manager.listEndpoints();
    const ep = endpoints.find((e) => e.id === id);
    if (!ep) throw new NotFoundError("Webhook", id);

    if (tenant && ep.organizationId) {
      this.tenantManager.enforce(tenant, {
        organizationId: ep.organizationId,
        projectId: ep.projectId ?? undefined,
      });
    }

    await this.manager.deleteEndpoint(id);
  }

  async deliver(eventType: string, payload: Record<string, unknown>, tenant?: TenantContext): Promise<WebhookDelivery[]> {
    return this.manager.deliver(eventType, payload, {
      organizationId: tenant?.organizationId,
      projectId: tenant?.projectId,
    });
  }

  async getDelivery(id: string): Promise<WebhookDelivery | null> {
    return this.manager.getDelivery(id);
  }

  async listDeliveries(webhookId?: string): Promise<WebhookDelivery[]> {
    return this.manager.listDeliveries(webhookId);
  }
}

let instance: WebhookService | null = null;
export function getWebhookService(): WebhookService {
  if (!instance) instance = new WebhookService();
  return instance;
}
