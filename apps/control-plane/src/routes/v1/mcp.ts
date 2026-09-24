import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getMCPService } from "../../modules/mcp/service.js";

const RegisterMCPServerSchema = z.object({
  name: z.string().min(1),
  endpoint: z.string().url(),
  version: z.string().optional(),
  tools: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        inputSchema: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
});

const CallToolSchema = z.object({
  toolName: z.string().min(1),
  args: z.record(z.unknown()).default({}),
});

export async function mcpRoutes(app: FastifyInstance) {
  const service = getMCPService();

  app.get("/servers", async () => {
    const servers = await service.listServers();
    return { servers, total: servers.length, message: "MCP servers bridged as A2A agents" };
  });

  app.get("/discover", async (req) => {
    const { skill } = req.query as any;
    const result = await service.discover(skill);
    return { agents: result, total: result.length, skill };
  });

  app.post("/servers", async (req, reply) => {
    try {
      const parsed = RegisterMCPServerSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } });
      }

      const tenant = (req as any).tenant ?? {};
      const result = await service.registerServer({
        name: parsed.data.name,
        endpoint: parsed.data.endpoint,
        tools: parsed.data.tools as any,
        tenant,
      });

      return reply.status(201).send(result);
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "REGISTER_FAILED", message: e.message } });
    }
  });

  app.post("/servers/:name/tools/:toolName/call", async (req, reply) => {
    const { name, toolName } = req.params as { name: string; toolName: string };
    try {
      const parsed = CallToolSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } });
      }

      const tenant = (req as any).tenant ?? {};
      const result = await service.callTool(name, toolName, parsed.data.args, tenant);

      return { result, server: name, tool: toolName };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "CALL_FAILED", message: e.message } });
    }
  });

  // A2A -> MCP translation endpoint
  app.post("/bridge/a2a-to-mcp", async (req, reply) => {
    const { serverName, skillId, message, context } = (req.body as any) ?? {};
    if (!serverName || !skillId || !message) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "serverName, skillId, message required" } });
    }

    try {
      const tenant = (req as any).tenant ?? {};
      const result = await service.callTool(serverName, skillId, { message, ...context }, tenant);
      return { result };
    } catch (err) {
      const e = err as any;
      return reply.status(500).send({ error: { code: "BRIDGE_FAILED", message: e.message } });
    }
  });
}
