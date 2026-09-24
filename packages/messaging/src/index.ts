/**
 * Messaging - Production-grade Message Router for AgentMesh
 * Supports sync, async, streaming, with full metadata
 */

import { z } from "zod";
import { generateId, nowIso } from "@agentmesh/core";
import { createEventBus, type AgentMeshEvent } from "@agentmesh/events";

export const MessageRoleSchema = z.enum(["user", "agent", "system"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageContentTypeSchema = z.enum([
  "text",
  "json",
  "binary",
  "multipart",
  "a2a-message",
  "stream-chunk",
]);
export type MessageContentType = z.infer<typeof MessageContentTypeSchema>;

export const MessageSchema = z.object({
  id: z.string().min(1),
  messageId: z.string().min(1), // alias for id for compatibility
  sender: z.string().min(1), // agentId or userId
  receiver: z.string().min(1), // agentId
  taskId: z.string().optional(),
  contextId: z.string().optional(),
  sessionId: z.string().optional(),
  traceId: z.string().optional(),
  correlationId: z.string().optional(),
  parentMessageId: z.string().optional(),
  timestamp: z.string().datetime(),
  contentType: MessageContentTypeSchema.default("text"),
  content: z.record(z.unknown()), // flexible content
  metadata: z.record(z.unknown()).optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
});

export type Message = z.infer<typeof MessageSchema>;

export interface SendMessageInput {
  sender: string;
  receiver: string;
  taskId?: string;
  contextId?: string;
  sessionId?: string;
  traceId?: string;
  correlationId?: string;
  parentMessageId?: string;
  contentType?: MessageContentType;
  content: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  organizationId?: string;
  projectId?: string;
}

export interface MessageFilter {
  taskId?: string;
  contextId?: string;
  sessionId?: string;
  traceId?: string;
  sender?: string;
  receiver?: string;
  organizationId?: string;
  projectId?: string;
  correlationId?: string;
  limit?: number;
  offset?: number;
}

export type DeliveryMode = "sync" | "async" | "streaming";

export interface MessageDeliveryOptions {
  mode: DeliveryMode;
  timeoutMs?: number;
  retries?: number;
  requireAck?: boolean;
}

// In-memory message store for Phase 4 (Postgres in production)
class InMemoryMessageStore {
  private messages = new Map<string, Message>();
  private byTask = new Map<string, string[]>();
  private byContext = new Map<string, string[]>();
  private byTrace = new Map<string, string[]>();

  async save(msg: Message): Promise<Message> {
    this.messages.set(msg.id, msg);
    if (msg.taskId) {
      const list = this.byTask.get(msg.taskId) ?? [];
      list.push(msg.id);
      this.byTask.set(msg.taskId, list);
    }
    if (msg.contextId) {
      const list = this.byContext.get(msg.contextId) ?? [];
      list.push(msg.id);
      this.byContext.set(msg.contextId, list);
    }
    if (msg.traceId) {
      const list = this.byTrace.get(msg.traceId) ?? [];
      list.push(msg.id);
      this.byTrace.set(msg.traceId, list);
    }
    return msg;
  }

  async getById(id: string): Promise<Message | null> {
    return this.messages.get(id) ?? null;
  }

  async list(filter: MessageFilter): Promise<{ messages: Message[]; total: number }> {
    let list = Array.from(this.messages.values());

    if (filter.taskId) list = list.filter(m => m.taskId === filter.taskId);
    if (filter.contextId) list = list.filter(m => m.contextId === filter.contextId);
    if (filter.sessionId) list = list.filter(m => m.sessionId === filter.sessionId);
    if (filter.traceId) list = list.filter(m => m.traceId === filter.traceId);
    if (filter.sender) list = list.filter(m => m.sender === filter.sender);
    if (filter.receiver) list = list.filter(m => m.receiver === filter.receiver);
    if (filter.organizationId) list = list.filter(m => m.organizationId === filter.organizationId);
    if (filter.projectId) list = list.filter(m => m.projectId === filter.projectId);
    if (filter.correlationId) list = list.filter(m => m.correlationId === filter.correlationId);

    list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const total = list.length;
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    list = list.slice(offset, offset + limit);

    return { messages: list, total };
  }
}

const memStore = new InMemoryMessageStore();

export class MessageRouter {
  private eventBus = createEventBus({ serviceName: "message-router", url: process.env.NATS_URL });
  private store = memStore;

  async send(
    input: SendMessageInput,
    opts: MessageDeliveryOptions = { mode: "async" }
  ): Promise<Message> {
    const id = generateId("msg");
    const now = nowIso();

    const message: Message = {
      id,
      messageId: id,
      sender: input.sender,
      receiver: input.receiver,
      taskId: input.taskId,
      contextId: input.contextId,
      sessionId: input.sessionId,
      traceId: input.traceId ?? generateId("trace"),
      correlationId: input.correlationId ?? generateId("corr"),
      parentMessageId: input.parentMessageId,
      timestamp: now,
      contentType: input.contentType ?? "text",
      content: input.content,
      metadata: input.metadata,
      organizationId: input.organizationId,
      projectId: input.projectId,
    };

    // Validate size (assume 1MB limit, checked at gateway too)
    const size = JSON.stringify(message.content).length;
    if (size > 1024 * 1024) {
      throw new Error(`Message content too large: ${size} bytes > 1MB`);
    }

    // Save
    await this.store.save(message);

    // Publish event based on delivery mode
    const eventType: AgentMeshEvent["type"] =
      opts.mode === "streaming" ? "message.sent" : "message.sent";

    try {
      const event: AgentMeshEvent = {
        id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type: eventType,
        source: "message-router",
        subject: `message.${message.receiver}`,
        data: { message, deliveryMode: opts.mode },
        timestamp: now,
        traceId: message.traceId,
        organizationId: message.organizationId,
        projectId: message.projectId,
      };
      await this.eventBus.publish(event);
    } catch (err) {
      console.warn(`[message-router] failed to publish event: ${(err as Error).message}`);
    }

    // For sync mode, we would wait for ack - simplified for Phase 4
    if (opts.mode === "sync" && opts.requireAck) {
      // In production, wait for ack via event bus with timeout
      // For now, just return
    }

    return message;
  }

  async getById(id: string): Promise<Message | null> {
    return this.store.getById(id);
  }

  async list(filter: MessageFilter): Promise<{ messages: Message[]; total: number }> {
    return this.store.list(filter);
  }

  // Streaming support - returns async iterable of messages for a task/context
  async *stream(filter: MessageFilter & { pollIntervalMs?: number }): AsyncIterable<Message> {
    const seen = new Set<string>();
    const interval = filter.pollIntervalMs ?? 1000;

    while (true) {
      const { messages } = await this.list({ ...filter, limit: 100 });
      for (const msg of messages) {
        if (!seen.has(msg.id)) {
          seen.add(msg.id);
          yield msg;
        }
      }
      await new Promise(r => setTimeout(r, interval));
    }
  }

  // Acknowledge receipt (for async delivery)
  async ack(messageId: string, receiver: string): Promise<void> {
    const msg = await this.store.getById(messageId);
    if (!msg) throw new Error(`Message ${messageId} not found`);
    if (msg.receiver !== receiver) throw new Error(`Receiver mismatch for ack`);

    try {
      const event: AgentMeshEvent = {
        id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type: "message.received",
        source: "message-router",
        subject: `message.${messageId}.ack`,
        data: { messageId, receiver, timestamp: nowIso() },
        timestamp: nowIso(),
        traceId: msg.traceId,
      };
      await this.eventBus.publish(event);
    } catch (err) {
      console.warn(`[message-router] ack publish failed: ${(err as Error).message}`);
    }
  }
}

let routerInstance: MessageRouter | null = null;

export function getMessageRouter(): MessageRouter {
  if (!routerInstance) routerInstance = new MessageRouter();
  return routerInstance;
}

export function createMessageRouter(): MessageRouter {
  return new MessageRouter();
}

// Factory for transport abstraction (future: support different transports)
export interface MessageTransport {
  readonly name: string;
  send(message: Message): Promise<void>;
  close(): Promise<void>;
}

export class InMemoryTransport implements MessageTransport {
  readonly name = "inmemory";
  async send(message: Message): Promise<void> {
    console.log(
      `[transport:inmemory] ${message.sender} -> ${message.receiver}: ${JSON.stringify(message.content).slice(0, 100)}`
    );
  }
  async close(): Promise<void> {}
}
