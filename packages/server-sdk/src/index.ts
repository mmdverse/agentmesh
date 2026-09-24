import type { AgentCard, AgentSkill } from "@agentmesh/a2a-protocol";
import type { TaskId, ContextId, SessionId } from "@agentmesh/core";

export interface TaskHandlerContext {
  taskId: TaskId;
  contextId: ContextId;
  sessionId: SessionId;
  message: { text: string; role: string };
  metadata?: Record<string, unknown>;
}

export interface TaskHandlerResult {
  text?: string;
  data?: Record<string, unknown>;
  artifacts?: Array<{ name: string; mimeType: string; data: string | Buffer }>;
  state?: "COMPLETED" | "INPUT_REQUIRED" | "FAILED";
}

export type TaskHandler = (ctx: TaskHandlerContext) => Promise<TaskHandlerResult>;

export interface AgentServerConfig {
  card: Omit<AgentCard, "url"> & { url?: string };
  skills?: AgentSkill[];
  port?: number;
  host?: string;
  taskHandler?: TaskHandler;
  onAuth?: (req: Request) => Promise<{ allowed: boolean; identity?: string }>;
  onError?: (err: Error) => void;
}

export function createAgentServer(config: AgentServerConfig) {
  const handlers = new Map<string, TaskHandler>();

  return {
    addSkill: (skill: AgentSkill, handler: TaskHandler) => {
      handlers.set(skill.id, handler);
    },

    setDefaultHandler: (handler: TaskHandler) => {
      handlers.set("__default__", handler);
    },

    getCard: (): AgentCard => {
      return {
        ...config.card,
        url: config.card.url ?? `http://${config.host ?? "localhost"}:${config.port ?? 3003}`,
        skills: config.skills ?? [],
      } as AgentCard;
    },

    // Phase 4 will implement full Fastify server with JSON-RPC, SSE, etc.
    // Phase 0: just return a stub that can be started
    listen: async () => {
      console.log(`[server-sdk] Agent Server stub listening - card: ${config.card.name}`);
      console.log(`[server-sdk] Full implementation in Phase 4`);
      return { card: config.card, handlers: Array.from(handlers.keys()) };
    },

    // For testing
    handleTask: async (ctx: TaskHandlerContext): Promise<TaskHandlerResult> => {
      const handler = handlers.get("__default__") ?? config.taskHandler;
      if (!handler) throw new Error("No task handler registered");
      return handler(ctx);
    },
  };
}

// Re-export useful types
export type { AgentCard, AgentSkill } from "@agentmesh/a2a-protocol";
