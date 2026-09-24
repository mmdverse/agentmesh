export type AgentMeshEventType =
  | "agent.registered"
  | "agent.updated"
  | "agent.unhealthy"
  | "agent.deleted"
  | "task.created"
  | "task.started"
  | "task.completed"
  | "task.failed"
  | "task.canceled"
  | "task.timeout"
  | "message.sent"
  | "message.received"
  | "artifact.created"
  | "policy.denied"
  | "webhook.delivered"
  | "webhook.failed";

export interface AgentMeshEvent<T = unknown> {
  id: string;
  type: AgentMeshEventType;
  source: string; // service name
  subject: string; // e.g. agent.<id> or task.<id>
  data: T;
  timestamp: string;
  traceId?: string;
  organizationId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export interface EventBus {
  publish<T>(event: AgentMeshEvent<T>): Promise<void>;
  subscribe<T>(type: AgentMeshEventType | "*", handler: (event: AgentMeshEvent<T>) => Promise<void> | void): Promise<{ unsubscribe: () => Promise<void> }>;
  close(): Promise<void>;
}

export interface EventBusConfig {
  url?: string;
  serviceName: string;
}

// In-memory implementation for Phase 0 / tests
export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Set<(event: AgentMeshEvent) => Promise<void> | void>>();

  async publish<T>(event: AgentMeshEvent<T>): Promise<void> {
    const types = [event.type, "*"];
    for (const t of types) {
      const set = this.handlers.get(t);
      if (!set) continue;
      for (const h of set) {
        try {
          await h(event as AgentMeshEvent);
        } catch (err) {
          console.error(`[events] handler error for ${t}`, err);
        }
      }
    }
  }

  async subscribe<T>(type: AgentMeshEventType | "*", handler: (event: AgentMeshEvent<T>) => Promise<void> | void) {
    const key = type;
    if (!this.handlers.has(key)) this.handlers.set(key, new Set());
    this.handlers.get(key)!.add(handler as any);
    return {
      unsubscribe: async () => {
        this.handlers.get(key)?.delete(handler as any);
      },
    };
  }

  async close(): Promise<void> {
    this.handlers.clear();
  }
}

export function createEventBus(config: EventBusConfig): EventBus {
  // Phase 0: always in-memory. Phase 1+ will switch to NATS based on URL
  if (config.url?.startsWith("nats://")) {
    console.log("[events] NATS URL detected but using InMemory for Phase 0. Will upgrade in Phase 1.");
  }
  return new InMemoryEventBus();
}
