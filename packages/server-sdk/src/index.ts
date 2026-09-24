import type { AgentCard, AgentSkill } from "@agentmesh/a2a-protocol";
import { getObservability } from "@agentmesh/observability";

export interface TaskHandlerContext {
  taskId: string;
  contextId: string;
  sessionId: string;
  traceId?: string;
  message: { text: string; role: string; parts?: any[] };
  metadata?: Record<string, unknown>;
  organizationId?: string;
  projectId?: string;
  artifacts?: Array<{ id: string; name: string; url?: string }>;
  // For streaming
  stream?: (chunk: { text?: string; data?: any; state?: string }) => void;
}

export interface TaskHandlerResult {
  text?: string;
  data?: Record<string, unknown>;
  artifacts?: Array<{
    name: string;
    mimeType: string;
    data: string | Buffer;
    description?: string;
  }>;
  state?: "COMPLETED" | "INPUT_REQUIRED" | "FAILED";
  metadata?: Record<string, unknown>;
}

export type TaskHandler = (ctx: TaskHandlerContext) => Promise<TaskHandlerResult>;

export interface AgentServerConfig {
  card: Omit<AgentCard, "url"> & { url?: string };
  skills?: AgentSkill[];
  port?: number;
  host?: string;
  taskHandler?: TaskHandler;
  onAuth?: (req: Request) => Promise<{ allowed: boolean; identity?: string }>;
  onAuthorize?: (ctx: TaskHandlerContext) => Promise<{ allowed: boolean; reason?: string }>;
  onError?: (err: Error) => void;
  middleware?: Array<(req: any, reply: any, next: () => void) => void>;
  enableTelemetry?: boolean;
  enableStreaming?: boolean;
}

export function createAgentServer(config: AgentServerConfig) {
  const handlers = new Map<string, TaskHandler>();
  const obs = getObservability();

  return {
    addSkill: (skill: AgentSkill, handler: TaskHandler) => {
      handlers.set(skill.id, handler);
      if (!config.skills) config.skills = [];
      if (!config.skills.find(s => s.id === skill.id)) {
        config.skills.push(skill);
      }
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

    // Full Fastify server implementation for Phase 4
    listen: async () => {
      const Fastify = (await import("fastify")).default;
      const app = Fastify({ logger: { level: "info" } });

      const card = {
        ...config.card,
        url: config.card.url ?? `http://${config.host ?? "localhost"}:${config.port ?? 3003}`,
        skills: config.skills ?? [],
      } as AgentCard;

      // Health
      app.get("/health", async () => ({ status: "ok", agent: card.name, version: card.version }));
      app.get("/", async () => ({
        name: card.name,
        version: card.version,
        description: card.description,
      }));
      app.get("/.well-known/agent.json", async () => card);
      app.get("/.well-known/agent-card.json", async () => card);

      // A2A JSON-RPC endpoint
      app.post("/", async (req: any, reply: any) => {
        const traceId = (req.headers["x-trace-id"] as string) ?? `trace_${Date.now().toString(36)}`;
        const span = obs["tracer"].startSpan(`agent.${card.name}.invoke`, {
          attributes: { traceId, agent: card.name, method: (req.body as any)?.method },
        });

        try {
          const body = req.body as any;

          // Auth hook
          if (config.onAuth) {
            const authResult = await config.onAuth(req as any);
            if (!authResult.allowed) {
              obs.endSpan(span.id, { error: new Error("Unauthorized") });
              return reply
                .status(401)
                .send({ error: { code: "UNAUTHORIZED", message: "Not allowed" } });
            }
          }

          if (!body || !body.method) {
            return reply
              .status(400)
              .send({ error: { code: "INVALID_REQUEST", message: "Missing method" } });
          }

          // Handle A2A methods
          if (body.method === "message/send" || body.method === "tasks/send") {
            const params = body.params ?? {};
            const taskId = params.taskId ?? `task_${Date.now().toString(36)}`;
            const contextId = params.contextId ?? `ctx_${Date.now().toString(36)}`;
            const sessionId = params.sessionId ?? `sess_${Date.now().toString(36)}`;
            const message = params.message ?? { text: params.text ?? "Hello" };

            const ctx: TaskHandlerContext = {
              taskId,
              contextId,
              sessionId,
              traceId,
              message: {
                text: message.text ?? message.parts?.[0]?.text ?? "Hello",
                role: message.role ?? "user",
                parts: message.parts,
              },
              metadata: params.metadata,
              organizationId: req.headers["x-organization-id"] as string,
              projectId: req.headers["x-project-id"] as string,
            };

            if (config.onAuthorize) {
              const authz = await config.onAuthorize(ctx);
              if (!authz.allowed) {
                obs.endSpan(span.id, { error: new Error(authz.reason ?? "Forbidden") });
                return reply
                  .status(403)
                  .send({ error: { code: "FORBIDDEN", message: authz.reason ?? "Not allowed" } });
              }
            }

            const handler =
              handlers.get(params.skillId) ?? handlers.get("__default__") ?? config.taskHandler;
            if (!handler) {
              return reply
                .status(500)
                .send({ error: { code: "NO_HANDLER", message: "No task handler registered" } });
            }

            const result = await handler(ctx);

            obs.endSpan(span.id, { attributes: { state: result.state ?? "COMPLETED" } });

            // Return A2A-compatible response
            return {
              jsonrpc: "2.0",
              id: body.id,
              result: {
                taskId,
                contextId,
                sessionId,
                state: result.state ?? "COMPLETED",
                message: { role: "agent", parts: [{ type: "text", text: result.text ?? "" }] },
                artifacts: result.artifacts?.map(a => ({
                  name: a.name,
                  mimeType: a.mimeType,
                  description: a.description,
                })),
                data: result.data,
                metadata: result.metadata,
              },
            };
          }

          // Handle task streaming (SSE)
          if (body.method === "tasks/sendSubscribe") {
            reply.raw.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            });

            const params = body.params ?? {};
            const taskId = params.taskId ?? `task_${Date.now().toString(36)}`;
            const ctx: TaskHandlerContext = {
              taskId,
              contextId: params.contextId ?? `ctx_${Date.now().toString(36)}`,
              sessionId: params.sessionId ?? `sess_${Date.now().toString(36)}`,
              traceId,
              message: { text: params.message?.text ?? "Hello", role: "user" },
              metadata: params.metadata,
              stream: chunk => {
                reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
              },
            };

            const handler = handlers.get("__default__") ?? config.taskHandler;
            if (handler) {
              const result = await handler(ctx);
              reply.raw.write(
                `data: ${JSON.stringify({ state: result.state ?? "COMPLETED", text: result.text })}\n\n`
              );
            }

            reply.raw.end();
            return reply;
          }

          return { jsonrpc: "2.0", id: body.id, result: { card } };
        } catch (err) {
          const e = err as Error;
          obs.endSpan(span.id, { error: e });
          config.onError?.(e);
          return reply.status(500).send({
            jsonrpc: "2.0",
            id: (req.body as any)?.id,
            error: { code: -32603, message: e.message },
          });
        }
      });

      // Tasks endpoint for direct invocation
      app.post("/v1/tasks", async (req: any, reply: any) => {
        const body = req.body as any;
        const ctx: TaskHandlerContext = {
          taskId: `task_${Date.now().toString(36)}`,
          contextId: body.contextId ?? `ctx_${Date.now().toString(36)}`,
          sessionId: body.sessionId ?? `sess_${Date.now().toString(36)}`,
          message: { text: body.message?.text ?? "Hello", role: "user" },
          metadata: body.metadata,
        };

        const handler = handlers.get("__default__") ?? config.taskHandler;
        if (!handler) {
          return reply.status(500).send({ error: { code: "NO_HANDLER", message: "No handler" } });
        }

        const result = await handler(ctx);
        return { taskId: ctx.taskId, state: result.state ?? "COMPLETED", result };
      });

      const host = config.host ?? "0.0.0.0";
      const port = config.port ?? 3003;

      await app.listen({ host, port });
      console.log(
        `[server-sdk] Agent ${card.name} v${card.version} listening at http://${host}:${port}`
      );
      console.log(`[server-sdk] Card: http://${host}:${port}/.well-known/agent.json`);

      return { app, card, url: `http://${host}:${port}`, handlers: Array.from(handlers.keys()) };
    },

    handleTask: async (ctx: TaskHandlerContext): Promise<TaskHandlerResult> => {
      const handler = handlers.get("__default__") ?? config.taskHandler;
      if (!handler) throw new Error("No task handler registered");
      return handler(ctx);
    },

    // For testing: get observability
    getObservability: () => obs,
  };
}

// Re-export useful types
export type { AgentCard, AgentSkill } from "@agentmesh/a2a-protocol";
export { getObservability } from "@agentmesh/observability";
