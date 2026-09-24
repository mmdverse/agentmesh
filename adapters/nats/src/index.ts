import {
  connect,
  type NatsConnection,
  type JetStreamClient,
  type JetStreamManager,
  StringCodec,
  RetentionPolicy,
  type Subscription,
} from "nats";

export interface NatsConfig {
  url: string;
  name?: string;
}

let connection: NatsConnection | null = null;
let jetstream: JetStreamClient | null = null;
let jetstreamManager: JetStreamManager | null = null;

const sc = StringCodec();

export async function createNatsConnection(
  config: NatsConfig
): Promise<{ nc: NatsConnection; js: JetStreamClient; jsm: JetStreamManager }> {
  const nc = await connect({ servers: config.url, name: config.name ?? "agentmesh" });
  console.log(`[nats] connected to ${config.url}`);
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();
  return { nc, js, jsm };
}

export async function getNats(
  config?: NatsConfig
): Promise<{ nc: NatsConnection; js: JetStreamClient; jsm: JetStreamManager }> {
  if (connection && jetstream && jetstreamManager) {
    return { nc: connection, js: jetstream, jsm: jetstreamManager };
  }
  const url = config?.url ?? process.env.NATS_URL ?? "nats://localhost:4222";
  const { nc, js, jsm } = await createNatsConnection({ url, name: config?.name });
  connection = nc;
  jetstream = js;
  jetstreamManager = jsm;

  // Ensure default stream exists
  try {
    await jsm.streams.info("AGENTMESH");
  } catch {
    console.log("[nats] creating stream AGENTMESH");
    await jsm.streams.add({
      name: "AGENTMESH",
      subjects: ["agentmesh.>"],
      retention: RetentionPolicy.Limits,
      max_age: 24 * 60 * 60 * 1_000_000_000, // 24h nanos
    });
  }

  return { nc: connection, js: jetstream, jsm: jetstreamManager };
}

export async function closeNats(): Promise<void> {
  if (connection) {
    await connection.drain();
    await connection.close();
    connection = null;
    jetstream = null;
    jetstreamManager = null;
  }
}

// Event Bus implementation using NATS (for Phase 1+)
export class NatsEventBus {
  constructor(private js: JetStreamClient) {}

  async publish(subject: string, data: unknown): Promise<void> {
    const payload = sc.encode(JSON.stringify(data));
    await this.js.publish(subject, payload);
  }

  async subscribe(
    subject: string,
    handler: (data: unknown) => void
  ): Promise<{ unsubscribe: () => Promise<void> }> {
    // Phase 1 will implement proper consumer groups
    console.log(`[nats] subscribe stub for ${subject}`);
    return { unsubscribe: async () => {} };
  }
}
