import {
  getMessageRouter,
  type SendMessageInput,
  type MessageFilter,
  type Message,
  type MessageDeliveryOptions,
} from "@agentmesh/messaging";
import { getTenantManager, type TenantContext } from "@agentmesh/tenancy";
import { ValidationError, NotFoundError } from "@agentmesh/core";

export class MessageService {
  private router = getMessageRouter();
  private tenantManager = getTenantManager();

  async send(
    input: SendMessageInput & { tenant?: TenantContext },
    opts?: MessageDeliveryOptions
  ): Promise<Message> {
    if (input.tenant) {
      input.organizationId = input.organizationId ?? input.tenant.organizationId;
      input.projectId = input.projectId ?? input.tenant.projectId;
    }

    // Validate required fields
    if (!input.sender) throw new ValidationError("sender is required");
    if (!input.receiver) throw new ValidationError("receiver is required");
    if (!input.content) throw new ValidationError("content is required");

    return this.router.send(input, opts);
  }

  async getById(id: string, tenant?: TenantContext): Promise<Message> {
    const msg = await this.router.getById(id);
    if (!msg) throw new NotFoundError("Message", id);

    if (tenant && msg.organizationId) {
      this.tenantManager.enforce(tenant, {
        organizationId: msg.organizationId,
        projectId: msg.projectId ?? undefined,
      });
    }

    return msg;
  }

  async list(
    filter: MessageFilter & { tenant?: TenantContext }
  ): Promise<{ messages: Message[]; total: number }> {
    if (filter.tenant) {
      filter.organizationId = filter.organizationId ?? filter.tenant.organizationId;
      filter.projectId = filter.projectId ?? filter.tenant.projectId;
    }
    return this.router.list(filter);
  }

  async ack(messageId: string, receiver: string, tenant?: TenantContext): Promise<void> {
    const msg = await this.router.getById(messageId);
    if (!msg) throw new NotFoundError("Message", messageId);

    if (tenant && msg.organizationId) {
      this.tenantManager.enforce(tenant, {
        organizationId: msg.organizationId,
        projectId: msg.projectId ?? undefined,
      });
    }

    return this.router.ack(messageId, receiver);
  }
}

let instance: MessageService | null = null;
export function getMessageService(): MessageService {
  if (!instance) instance = new MessageService();
  return instance;
}
