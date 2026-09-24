import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getWebhookService } from "../../modules/webhooks/service.js";

const RegisterWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  headers: z.record(z.string()).optional(),
  secret: z.string().optional(),
});

export async function webhooksRoutes(app: FastifyInstance) {
  const service = getWebhookService();

  app.get("/", async (req) => {
    const { organizationId, projectId } = req.query as any;
    const tenant = (req as any).tenant ?? {};
    const endpoints = await service.list({ organizationId, projectId, tenant });
    return { webhooks: endpoints, total: endpoints.length };
  });

  app.post("/", async (req, reply) => {
    try {
      const parsed = RegisterWebhookSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } });
      }

      const tenant = (req as any).tenant ?? {};
      const endpoint = await service.register({ ...parsed.data, tenant });

      return reply.status(201).send({ webhook: endpoint });
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 400).send({ error: { code: e.code ?? "REGISTER_FAILED", message: e.message } });
    }
  });

  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenant = (req as any).tenant ?? {};
    try {
      await service.delete(id, tenant);
      return { success: true, id };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "DELETE_FAILED", message: e.message } });
    }
  });

  app.get("/:id/deliveries", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const deliveries = await service.listDeliveries(id);
      return { webhookId: id, deliveries, total: deliveries.length };
    } catch (err) {
      const e = err as any;
      return reply.status(500).send({ error: { code: "LIST_FAILED", message: e.message } });
    }
  });

  app.get("/deliveries", async () => {
    const deliveries = await service.listDeliveries();
    return { deliveries, total: deliveries.length };
  });

  app.get("/deliveries/:deliveryId", async (req, reply) => {
    const { deliveryId } = req.params as { deliveryId: string };
    const delivery = await service.getDelivery(deliveryId);
    if (!delivery) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: `Delivery ${deliveryId} not found` } });
    }
    return { delivery };
  });

  // Test delivery
  app.post("/test", async (req, reply) => {
    const { eventType = "test.event", payload = { test: true } } = (req.body as any) ?? {};
    const tenant = (req as any).tenant ?? {};
    try {
      const deliveries = await service.deliver(eventType, payload, tenant);
      return { deliveries, total: deliveries.length };
    } catch (err) {
      const e = err as any;
      return reply.status(500).send({ error: { code: "DELIVERY_FAILED", message: e.message } });
    }
  });
}
