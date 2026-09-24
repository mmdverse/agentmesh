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
  source: string;
  subject: string;
  data: T;
  timestamp: string;
  traceId?: string;
  organizationId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export interface EventBus {
  publish<T>(event: AgentMeshEvent<T>): Promise<void>;
  subscribe<T>(
    type: AgentMeshEventType | "*",
    handler: (event: AgentMeshEvent<T>) => Promise<void> | void
  ): Promise<{ unsubscribe: () => Promise<void> }>;
  close(): Promise<void>;
}

export interface EventBusConfig {
  url?: string;
  serviceName: string;
  useNats?: boolean;
}

// In-memory implementation for Phase 0 / tests / fallback
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

  async subscribe<T>(
    type: AgentMeshEventType | "*",
    handler: (event: AgentMeshEvent<T>) => Promise<void> | void
  ) {
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

// NATS JetStream implementation - lazy loaded to avoid hard dep
export class NatsJetStreamEventBus implements EventBus {
  private nc: any = null;
  private js: any = null;
  private jsm: any = null;
  private sc: any = null;
  private subscriptions: any[] = [];
  private isConnected = false;
  private fallback: InMemoryEventBus;
  private handlers = new Map<string, Set<(event: AgentMeshEvent) => Promise<void> | void>>();

  constructor(private config: EventBusConfig) {
    this.fallback = new InMemoryEventBus();
  }

  private async ensureConnected(): Promise<void> {
    if (this.isConnected) return;

    const url = this.config.url ?? process.env.NATS_URL ?? "nats://localhost:4222";
    if (!url.startsWith("nats://") && !url.startsWith("tls://")) {
      throw new Error("Invalid NATS URL");
    }

    try {
      // Dynamic import to keep optional
      const nats = await import("nats");
      const { connect, StringCodec, RetentionPolicy } = nats as any;
      this.sc = StringCodec();

      this.nc = await connect({
        servers: url,
        name: this.config.serviceName,
        maxReconnectAttempts: 5,
        reconnectTimeWait: 1000,
      });

      this.js = this.nc.jetstream();
      this.jsm = await this.nc.jetstreamManager();

      // Ensure stream exists
      try {
        await this.jsm.streams.info("AGENTMESH");
      } catch {
        console.log("[events:nats] creating stream AGENTMESH");
        await this.jsm.streams.add({
          name: "AGENTMESH",
          subjects: ["agentmesh.>"],
          retention: RetentionPolicy.Limits,
          max_age: 24 * 60 * 60 * 1_000_000_000,
          storage: "memory" as any,
        });
      }

      this.isConnected = true;
      console.log(`[events:nats] connected to ${url} as ${this.config.serviceName}`);
    } catch (err) {
      console.warn(
        `[events:nats] failed to connect to ${url}, falling back to in-memory: ${(err as Error).message}`
      );
      throw err;
    }
  }

  async publish<T>(event: AgentMeshEvent<T>): Promise<void> {
    // Always publish to in-memory handlers first for local subscribers
    await this.fallback.publish(event);

    // Also notify NATS if connected, but don't fail if not
    try {
      await this.ensureConnected();
      if (this.js && this.sc) {
        const subject = `agentmesh.${event.type.replace(/\./g, ".")}.${event.subject.replace(/\./g, "_")}`;
        const payload = this.sc.encode(JSON.stringify(event));
        await this.js.publish(subject, payload);
      }
    } catch (err) {
      // Non-fatal - in-memory already delivered
      console.warn(`[events:nats] publish failed, in-memory delivered: ${(err as Error).message}`);
    }

    // Notify local handlers for wildcard
    const types = [event.type, "*"];
    for (const t of types) {
      const set = this.handlers.get(t);
      if (!set) continue;
      for (const h of set) {
        try {
          await h(event as AgentMeshEvent);
        } catch (e) {
          console.error(`[events:nats] handler error for ${t}`, e);
        }
      }
    }
  }

  async subscribe<T>(
    type: AgentMeshEventType | "*",
    handler: (event: AgentMeshEvent<T>) => Promise<void> | void
  ) {
    const key = type;
    if (!this.handlers.has(key)) this.handlers.set(key, new Set());
    this.handlers.get(key)!.add(handler as any);

    // Also subscribe to NATS JetStream if possible
    try {
      await this.ensureConnected();
      if (this.js && this.nc) {
        const subject = type === "*" ? "agentmesh.>" : `agentmesh.${type}.>`;
        const sub = await this.js.subscribe(subject, {
          durable: `${this.config.serviceName}_${type}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32),
        });

        (async () => {
          for await (const msg of sub) {
            try {
              const decoded = this.sc.decode(msg.data);
              const event = JSON.parse(decoded) as AgentMeshEvent<T>;
              if (type === "*" || event.type === type) {
                await handler(event);
              }
              msg.ack();
            } catch (e) {
              console.warn(`[events:nats] failed to process message: ${(e as Error).message}`);
            }
          }
        })();

        this.subscriptions.push(sub);
      }
    } catch {
      // NATS not available, in-memory handlers still work
    }

    // Also register in fallback for publish path
    await this.fallback.subscribe(type, handler as any);

    return {
      unsubscribe: async () => {
        this.handlers.get(key)?.delete(handler as any);
      },
    };
  }

  async close(): Promise<void> {
    for (const sub of this.subscriptions) {
      try {
        await sub.unsubscribe();
      } catch {}
    }
    this.subscriptions = [];
    if (this.nc) {
      try {
        await this.nc.drain();
        await this.nc.close();
      } catch {}
      this.nc = null;
      this.js = null;
      this.jsm = null;
      this.isConnected = false;
    }
    await this.fallback.close();
    this.handlers.clear();
  }
}

export function createEventBus(config: EventBusConfig): EventBus {
  // If URL is NATS and useNats not explicitly false, try NATS JetStream
  const shouldUseNats =
    config.url?.startsWith("nats://") || config.url?.startsWith("tls://") || config.useNats;

  if (shouldUseNats) {
    console.log(
      `[events] using NATS JetStream event bus for ${config.serviceName} at ${config.url}`
    );
    return new NatsJetStreamEventBus(config);
  }

  console.log(`[events] using InMemory event bus for ${config.serviceName}`);
  return new InMemoryEventBus();
}

// Re-export for convenience
export { InMemoryEventBus as MemoryEventBus };
