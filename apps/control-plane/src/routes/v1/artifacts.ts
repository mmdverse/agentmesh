import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getArtifactService } from "../../modules/artifacts/service.js";

const CreateArtifactSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  contentType: z.string().min(1),
  data: z.string().optional(), // base64 or text for JSON
  jsonData: z.record(z.unknown()).optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  agentId: z.string().optional(),
  retentionDays: z.number().int().positive().optional(),
  accessControl: z.enum(["private", "public", "organization", "project"]).optional(),
  tags: z.array(z.string()).optional(),
});

export async function artifactsRoutes(app: FastifyInstance) {
  const service = getArtifactService();

  app.get("/", async (req) => {
    const { organizationId, projectId, taskId, agentId, contentType, limit = "20", offset = "0" } = req.query as any;
    const tenant = (req as any).tenant ?? {};

    const { artifacts, total } = await service.list({
      organizationId,
      projectId,
      taskId,
      agentId,
      contentType,
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0,
      tenant,
    });

    return { artifacts, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) };
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenant = (req as any).tenant ?? {};
    try {
      const meta = await service.getMetadata(id, tenant);
      return { artifact: meta };
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 404).send({ error: { code: e.code ?? "NOT_FOUND", message: e.message } });
    }
  });

  app.get("/:id/data", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenant = (req as any).tenant ?? {};
    try {
      const { metadata, data, contentType } = await service.getById(id, tenant);
      reply.header("Content-Type", contentType);
      reply.header("X-Artifact-Id", metadata.id);
      reply.header("X-Artifact-Checksum", metadata.checksum ?? "");
      return reply.send(data);
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 404).send({ error: { code: e.code ?? "NOT_FOUND", message: e.message } });
    }
  });

  app.get("/:id/url", async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenant = (req as any).tenant ?? {};
    try {
      const result = await service.presignedUrl(id, tenant);
      return result;
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 404).send({ error: { code: e.code ?? "NOT_FOUND", message: e.message } });
    }
  });

  app.post("/", async (req, reply) => {
    try {
      const parsed = CreateArtifactSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } });
      }

      const tenant = (req as any).tenant ?? {};
      const auth = (req as any).auth ?? {};

      let data: Buffer | string;
      if (parsed.data.jsonData) {
        data = JSON.stringify(parsed.data.jsonData);
      } else if (parsed.data.data) {
        // Try base64 decode if looks like base64, otherwise use as text
        try {
          // If data is base64 and contentType is binary, decode
          if (parsed.data.contentType.startsWith("text/") || parsed.data.contentType === "application/json") {
            data = parsed.data.data;
          } else {
            data = Buffer.from(parsed.data.data, "base64");
          }
        } catch {
          data = parsed.data.data;
        }
      } else {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "data or jsonData required" } });
      }

      const artifact = await service.create({
        name: parsed.data.name,
        description: parsed.data.description,
        contentType: parsed.data.contentType,
        data,
        organizationId: parsed.data.organizationId,
        projectId: parsed.data.projectId,
        taskId: parsed.data.taskId,
        agentId: parsed.data.agentId,
        createdBy: auth.identity?.id,
        retentionDays: parsed.data.retentionDays,
        accessControl: parsed.data.accessControl,
        tags: parsed.data.tags,
        tenant,
      });

      return reply.status(201).send({ artifact });
    } catch (err) {
      const e = err as any;
      return reply.status(e.statusCode ?? 500).send({ error: { code: e.code ?? "CREATE_FAILED", message: e.message } });
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
}
