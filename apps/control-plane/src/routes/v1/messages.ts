import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getMessageService } from "../../modules/messages/service.js";

const SendMessageSchema = z.object({
  sender: z.string().min(1),
  receiver: z.string().min(1),
  taskId: z.string().optional(),
  contextId: z.string().optional(),
  sessionId: z.string().optional(),
  traceId: z.string().optional(),
  correlationId: z.string().optional(),
  parentMessageId: z.string().optional(),
  contentType: z
    .enum(["text", "json", "binary", "multipart", "a2a-message", "stream-chunk"])
    .optional(),
  content: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  deliveryMode: z.enum(["sync", "async", "streaming"]).optional(),
});

export async function messagesRoutes(app: FastifyInstance) {
  const service = getMessageService();

  app.get("/", async req => {
    const {
      taskId,
      contextId,
      sessionId,
      traceId,
      sender,
      receiver,
      organizationId,
      projectId,
      correlationId,
      limit = "50",
      offset = "0",
    } = req.query as any;
    const tenant = (req as any).tenant ?? {};

    const { messages, total } = await service.list({
      taskId,
      contextId,
      sessionId,
      traceId,
      sender,
      receiver,
      organizationId,
      projectId,
      correlationId,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
      tenant,
    });

    return { messages, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) };
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenant = (req as any).tenant ?? {};
    try {
      const message = await service.getById(id, tenant);
      return { message };
    } catch (err) {
      const e = err as any;
      return reply
        .status(e.statusCode ?? 404)
        .send({ error: { code: e.code ?? "NOT_FOUND", message: e.message } });
    }
  });

  app.post("/", async (req, reply) => {
    try {
      const parsed = SendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        });
      }

      const tenant = (req as any).tenant ?? {};
      const message = await service.send({ ...parsed.data, tenant } as any, {
        mode: parsed.data.deliveryMode ?? "async",
        requireAck: parsed.data.deliveryMode === "sync",
      });

      return reply.status(201).send({ message });
    } catch (err) {
      const e = err as any;
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: { code: e.code ?? "SEND_FAILED", message: e.message } });
    }
  });

  app.post("/:id/ack", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { receiver } = (req.body as any) ?? {};
    const tenant = (req as any).tenant ?? {};

    if (!receiver) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: "receiver required for ack" } });
    }

    try {
      await service.ack(id, receiver, tenant);
      return { success: true, messageId: id, receiver };
    } catch (err) {
      const e = err as any;
      return reply
        .status(e.statusCode ?? 500)
        .send({ error: { code: e.code ?? "ACK_FAILED", message: e.message } });
    }
  });
}
