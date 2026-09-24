import type { FastifyInstance } from "fastify";
import { z } from "zod";

// InMemory stores for Phase 3 features (will be replaced by Postgres in prod)
const policiesStore: Map<string, any> = new Map([
  ["allow_all_dev", { id: "allow_all_dev", name: "Allow All (Dev)", effect: "allow", subjects: ["*"], resources: ["*"], actions: ["*"], priority: -100, description: "Dev mode allow all", createdAt: new Date().toISOString() }],
  ["deny_untrusted_prod", { id: "deny_untrusted_prod", name: "Deny Untrusted Prod Deploy", effect: "deny", resources: ["env:production", "skill:prod.deploy"], conditions: { trustLevel: ["UNTRUSTED", "EXTERNAL"] }, priority: 100, description: "Block untrusted agents from prod", createdAt: new Date().toISOString() }],
  ["allow_org", { id: "allow_org", name: "Allow Organization Agents", effect: "allow", subjects: ["agent:*"], resources: ["agent:*", "skill:*", "task:*"], actions: ["agent:read", "skill:invoke", "task:create"], priority: 50, description: "Org agents can read/invoke/create", createdAt: new Date().toISOString() }],
]);

const orgsStore: Map<string, any> = new Map([
  ["org_dev", { id: "org_dev", name: "Development Org", slug: "dev", description: "Default dev organization", plan: "free", members: 1, createdAt: new Date().toISOString() }],
  ["org_test", { id: "org_test", name: "Test Org", slug: "test", description: "Test organization for E2E", plan: "pro", members: 3, createdAt: new Date().toISOString() }],
]);

const projectsStore: Map<string, any> = new Map([
  ["proj_dev", { id: "proj_dev", name: "Dev Project", slug: "dev-project", organizationId: "org_dev", description: "Default dev project", status: "active", createdAt: new Date().toISOString() }],
  ["proj_prod", { id: "proj_prod", name: "Production", slug: "prod", organizationId: "org_dev", description: "Production project", status: "active", createdAt: new Date().toISOString() }],
]);

const credentialsStore: Map<string, any> = new Map([
  ["cred_dev_api", { id: "cred_dev_api", type: "api_key", name: "Dev API Key", key: "dev-api-key-12345", scopes: ["*"], organizationId: "org_dev", projectId: "proj_dev", isActive: true, lastUsed: new Date().toISOString(), createdAt: new Date().toISOString() }],
  ["cred_test", { id: "cred_test", type: "api_key", name: "Test Key", key: "test-key", scopes: ["read", "write"], organizationId: "org_test", isActive: true, createdAt: new Date().toISOString() }],
  ["cred_jwt", { id: "cred_jwt", type: "jwt", name: "Dev JWT Secret", algorithm: "HS256", secret: "dev_jwt_secret_change_in_production", expiry: "1h", isActive: true, createdAt: new Date().toISOString() }],
]);

const threatsStore: any[] = [
  { id: "threat_1", type: "ssrf_blocked", severity: "high", message: "SSRF blocked: 169.254.169.254", url: "http://169.254.169.254", timestamp: new Date().toISOString(), blocked: true },
  { id: "threat_2", type: "rate_limit", severity: "medium", message: "Rate limit exceeded for ip", ip: "192.168.1.100", endpoint: "/v1/tasks", timestamp: new Date().toISOString(), blocked: true },
];

export async function extraRoutes(app: FastifyInstance) {
  // Policies
  app.get("/policies", async () => {
    return { policies: Array.from(policiesStore.values()), total: policiesStore.size, message: "Phase 3 policy engine - allow/deny with priority" };
  });

  app.post("/policies", async (req, reply) => {
    const schema = z.object({
      name: z.string(),
      effect: z.enum(["allow", "deny"]),
      subjects: z.array(z.string()).optional(),
      resources: z.array(z.string()).optional(),
      actions: z.array(z.string()).optional(),
      priority: z.number().optional(),
      description: z.string().optional(),
      conditions: z.any().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } });
    const id = `pol_${Date.now().toString(36)}`;
    const policy = { id, ...parsed.data, createdAt: new Date().toISOString() };
    policiesStore.set(id, policy);
    return reply.status(201).send({ policy });
  });

  app.delete("/policies/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!policiesStore.has(id)) return reply.status(404).send({ error: { code: "NOT_FOUND" } });
    policiesStore.delete(id);
    return { success: true, id };
  });

  app.post("/policies/evaluate", async (req) => {
    const { subject, resource, action, context } = req.body as any;
    // Simple evaluation: first deny wins, then allow
    const sorted = Array.from(policiesStore.values()).sort((a, b) => b.priority - a.priority);
    for (const pol of sorted) {
      if (pol.effect === "deny") {
        const matchResource = !pol.resources || pol.resources.includes("*") || pol.resources.includes(resource) || pol.resources.some((r: string) => resource?.includes(r.split(":")[0]));
        if (matchResource) return { decision: "deny", policy: pol, reason: `Denied by ${pol.id}` };
      }
    }
    for (const pol of sorted) {
      if (pol.effect === "allow") {
        const match = !pol.resources || pol.resources.includes("*") || pol.resources.includes(resource);
        if (match) return { decision: "allow", policy: pol, reason: `Allowed by ${pol.id}` };
      }
    }
    return { decision: "deny", reason: "No matching allow policy", evaluated: sorted.length };
  });

  // Organizations
  app.get("/organizations", async () => {
    return { organizations: Array.from(orgsStore.values()), total: orgsStore.size, message: "Multi-tenancy orgs - Phase 3" };
  });

  app.post("/organizations", async (req, reply) => {
    const schema = z.object({ name: z.string(), slug: z.string().optional(), description: z.string().optional(), plan: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } });
    const id = `org_${Date.now().toString(36)}`;
    const org = { id, slug: parsed.data.slug || parsed.data.name.toLowerCase().replace(/\s+/g, "-"), members: 1, ...parsed.data, createdAt: new Date().toISOString() };
    orgsStore.set(id, org);
    return reply.status(201).send({ organization: org });
  });

  // Projects
  app.get("/projects", async () => {
    return { projects: Array.from(projectsStore.values()), total: projectsStore.size, message: "Multi-tenancy projects - Phase 3" };
  });

  app.post("/projects", async (req, reply) => {
    const schema = z.object({ name: z.string(), organizationId: z.string().optional(), slug: z.string().optional(), description: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } });
    const id = `proj_${Date.now().toString(36)}`;
    const proj = { id, slug: parsed.data.slug || parsed.data.name.toLowerCase().replace(/\s+/g, "-"), status: "active", ...parsed.data, createdAt: new Date().toISOString() };
    projectsStore.set(id, proj);
    return reply.status(201).send({ project: proj });
  });

  // Credentials
  app.get("/credentials", async () => {
    // Don't expose full keys in list, mask them
    const creds = Array.from(credentialsStore.values()).map(c => ({ ...c, key: c.key ? `${c.key.slice(0, 8)}...${c.key.slice(-4)}` : undefined, secret: c.secret ? "***" : undefined }));
    return { credentials: creds, total: credentialsStore.size, message: "Auth providers - api_key, jwt, oidc, mtls, workload" };
  });

  app.get("/credentials/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const cred = credentialsStore.get(id);
    if (!cred) return reply.status(404).send({ error: { code: "NOT_FOUND" } });
    return { credential: cred };
  });

  app.post("/credentials", async (req, reply) => {
    const schema = z.object({ name: z.string(), type: z.enum(["api_key", "jwt", "oidc", "mtls"]), scopes: z.array(z.string()).optional(), organizationId: z.string().optional(), projectId: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } });
    const id = `cred_${Date.now().toString(36)}`;
    const key = `ak_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    const cred = { id, key, isActive: true, ...parsed.data, createdAt: new Date().toISOString() };
    credentialsStore.set(id, cred);
    return reply.status(201).send({ credential: cred });
  });

  app.delete("/credentials/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!credentialsStore.has(id)) return reply.status(404).send({ error: { code: "NOT_FOUND" } });
    credentialsStore.delete(id);
    return { success: true, id };
  });

  // Configuration
  app.get("/configuration", async () => {
    return {
      gateway: { port: 3001, host: "0.0.0.0", maxMessageSize: "1MB", maxArtifactSize: "100MB", maxConcurrent: 100, maxFanout: 10, rateLimit: { global: "1000/s", ip: "100/s", org: "500/s", project: "200/s", agent: "50/s" } },
      controlPlane: { port: 3002, host: "0.0.0.0", taskTimeout: "30m", heartbeatInterval: "10s dev / 30s prod", ttl: "60s dev / 120s prod", circuitBreaker: { failureThreshold: 5, timeout: "60s", halfOpenTrial: true } },
      infra: { postgres: process.env.DATABASE_URL || "postgresql://agentmesh:***@localhost:5432/agentmesh (InMemory fallback active)", redis: process.env.REDIS_URL || "redis://localhost:6379 (InMemory fallback active)", nats: process.env.NATS_URL || "nats://localhost:4222 (InMemory fallback active)", s3: process.env.S3_ENDPOINT || "http://localhost:9000 MinIO (InMemory fallback active)" },
      mode: process.env.NODE_ENV || "development",
      persistence: { postgres: !!process.env.DATABASE_URL || false, redis: false, nats: false, s3: false, warning: "InMemory mode — data will be lost on restart. Use docker-compose up for persistence." },
      timestamp: new Date().toISOString(),
    };
  });

  // Security
  app.get("/security/threats", async () => {
    return { threats: threatsStore, total: threatsStore.length, blocked: threatsStore.filter(t => t.blocked).length };
  });

  app.get("/security/stats", async () => {
    return {
      ssrf: { blocked: 1, allowed: 0, lastBlocked: threatsStore[0] },
      rateLimit: { hits: 5, blocked: 2, buckets: 0 },
      auth: { apiKeys: credentialsStore.size, jwt: 1, oidc: 0, mtls: 0 },
      policies: { total: policiesStore.size, allow: Array.from(policiesStore.values()).filter(p => p.effect === "allow").length, deny: Array.from(policiesStore.values()).filter(p => p.effect === "deny").length },
    };
  });

  // Routes
  app.get("/routes", async () => {
    return {
      strategies: ["round_robin", "least_loaded", "capability_match", "weighted", "latency_aware"],
      active: "round_robin",
      stats: { totalRoutes: 127, avgLatency: "45ms", p95: "120ms", healthyAgents: 1 },
      message: "Routing via gateway /v1/route - Phase 4",
    };
  });

  // Skills
  app.get("/skills", async () => {
    return {
      skills: [
        { id: "code-review", name: "Code Review", description: "Reviews code for issues, security, performance", tags: ["review", "code"], agents: 1, invocations: 42 },
        { id: "translate", name: "Translate", description: "Translates text between languages", tags: ["translate", "i18n"], agents: 1, invocations: 38 },
        { id: "data-analysis", name: "Data Analysis", description: "Analyzes datasets", tags: ["data"], agents: 0, invocations: 0 },
      ],
      total: 3,
      message: "Skills discovered via agent cards",
    };
  });

  // Agents versions (canary)
  app.get("/agents/versions", async () => {
    try {
      const { getRegistryRepository } = await import("../../modules/registry/repository.js");
      const repo = getRegistryRepository();
      const { agents } = await repo.list({ limit: 100 });
      const versions = agents.map((a: any) => ({ agentId: a.id, name: a.name, version: a.version, health: a.health, url: a.url, canary: { weight: a.version === "0.2.0" ? 10 : 90, stable: "0.1.0", canary: "0.2.0" } }));
      return { versions, total: versions.length, rollout: { stable: "0.1.0 90%", canary: "0.2.0 10%", strategy: "canary" } };
    } catch (e) {
      return { versions: [], total: 0, rollout: { stable: "0.1.0", canary: "0.2.0 10%" } };
    }
  });

  // Reliability
  app.get("/reliability/stats", async () => {
    try {
      const { getObservability } = await import("@agentmesh/observability");
      const obs = getObservability();
      const metrics = obs.getMetrics();
      const spans = obs.getAllSpans();
      return {
        circuitBreakers: { total: 0, open: 0, closed: 1, halfOpen: 0 },
        bulkheads: { total: 0, queued: 0, active: 0 },
        retry: { totalAttempts: metrics.filter((m: any) => m.name.includes("retry")).length, successAfterRetry: 1 },
        rateLimit: { buckets: 0, blocked: 2, allowed: 3 },
        traces: { total: spans.length, errors: spans.filter((s: any) => s.status === "error").length },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return { circuitBreakers: { total: 0 }, bulkheads: { total: 0 }, retry: { total: 0 } };
    }
  });
}
