/**
 * Webhooks - Secure Webhook Delivery for AgentMesh
 * Supports signed notifications, retries, exponential backoff, idempotency, replay protection, SSRF protection
 */

import { z } from "zod";
import { createHmac, randomBytes } from "node:crypto";
import { generateId, nowIso } from "@agentmesh/core";

export const WebhookEndpointSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  secret: z.string().min(16), // for signing
  events: z.array(z.string()).default(["*"]), // event types to subscribe
  isActive: z.boolean().default(true),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  headers: z.record(z.string()).optional(),
  timeoutMs: z.number().int().positive().default(10000),
  maxRetries: z.number().int().min(0).max(10).default(3),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WebhookEndpoint = z.infer<typeof WebhookEndpointSchema>;

export const WebhookDeliverySchema = z.object({
  id: z.string().min(1),
  webhookId: z.string().min(1),
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  url: z.string().url(),
  payload: z.record(z.unknown()),
  attempt: z.number().int().min(1).default(1),
  status: z.enum(["PENDING", "SUCCESS", "FAILED", "RETRYING", "DEAD_LETTER"]).default("PENDING"),
  responseStatus: z.number().int().optional(),
  responseBody: z.string().optional(),
  error: z.string().optional(),
  nextRetryAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>;

// SSRF protection
const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal",
];

const BLOCKED_IP_RANGES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^127\./,
  /^0\./,
];

export function isUrlAllowed(url: string): { allowed: boolean; reason?: string } {
  try {
    const parsed = new URL(url);

    // Only allow https in production, http allowed in dev for testing
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      return { allowed: false, reason: "Only HTTPS allowed in production" };
    }

    if (!["https:", "http:"].includes(parsed.protocol)) {
      return { allowed: false, reason: `Protocol ${parsed.protocol} not allowed` };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (BLOCKED_HOSTS.includes(hostname)) {
      return { allowed: false, reason: `Host ${hostname} is blocked (SSRF protection)` };
    }

    for (const pattern of BLOCKED_IP_RANGES) {
      if (pattern.test(hostname)) {
        return { allowed: false, reason: `IP range ${hostname} is blocked (SSRF protection)` };
      }
    }

    // Block metadata endpoints
    if (hostname.includes("metadata") || hostname.includes("169.254")) {
      return { allowed: false, reason: "Metadata endpoint blocked" };
    }

    return { allowed: true };
  } catch (err) {
    return { allowed: false, reason: `Invalid URL: ${(err as Error).message}` };
  }
}

// Signing

export function signPayload(payload: string, secret: string, timestamp?: string): string {
  const ts = timestamp ?? Date.now().toString();
  const data = `${ts}.${payload}`;
  const hmac = createHmac("sha256", secret).update(data).digest("hex");
  return `t=${ts},v1=${hmac}`;
}

export function verifySignature(payload: string, signature: string, secret: string, toleranceMs = 5 * 60 * 1000): boolean {
  try {
    const parts = signature.split(",");
    const tPart = parts.find((p) => p.startsWith("t="));
    const v1Part = parts.find((p) => p.startsWith("v1="));
    if (!tPart || !v1Part) return false;

    const timestamp = tPart.slice(2);
    const signatureHash = v1Part.slice(3);

    // Check timestamp tolerance (replay protection)
    const tsNum = parseInt(timestamp, 10);
    const now = Date.now();
    if (Math.abs(now - tsNum) > toleranceMs) {
      console.warn(`[webhooks] signature timestamp out of tolerance: ${timestamp}`);
      return false;
    }

    const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    return expected === signatureHash;
  } catch {
    return false;
  }
}

// Webhook Manager

class InMemoryWebhookStore {
  private endpoints = new Map<string, WebhookEndpoint>();
  private deliveries = new Map<string, WebhookDelivery>();

  async createEndpoint(input: Omit<WebhookEndpoint, "id" | "createdAt" | "updatedAt">): Promise<WebhookEndpoint> {
    const id = generateId("wh");
    const now = nowIso();
    const endpoint: WebhookEndpoint = { id, ...input, createdAt: now, updatedAt: now };
    this.endpoints.set(id, endpoint);
    return endpoint;
  }

  async getEndpoint(id: string): Promise<WebhookEndpoint | null> {
    return this.endpoints.get(id) ?? null;
  }

  async listEndpoints(filter?: { organizationId?: string; projectId?: string; isActive?: boolean }): Promise<WebhookEndpoint[]> {
    let list = Array.from(this.endpoints.values());
    if (filter?.organizationId) list = list.filter((e) => !e.organizationId || e.organizationId === filter.organizationId);
    if (filter?.projectId) list = list.filter((e) => !e.projectId || e.projectId === filter.projectId);
    if (filter?.isActive !== undefined) list = list.filter((e) => e.isActive === filter.isActive);
    return list;
  }

  async deleteEndpoint(id: string): Promise<boolean> {
    return this.endpoints.delete(id);
  }

  async saveDelivery(delivery: WebhookDelivery): Promise<void> {
    this.deliveries.set(delivery.id, delivery);
  }

  async getDelivery(id: string): Promise<WebhookDelivery | null> {
    return this.deliveries.get(id) ?? null;
  }

  async listDeliveries(webhookId?: string): Promise<WebhookDelivery[]> {
    let list = Array.from(this.deliveries.values());
    if (webhookId) list = list.filter((d) => d.webhookId === webhookId);
    return list;
  }
}

const memStore = new InMemoryWebhookStore();

export class WebhookManager {
  private store = memStore;

  async registerEndpoint(input: { url: string; events?: string[]; organizationId?: string; projectId?: string; headers?: Record<string, string>; secret?: string }): Promise<WebhookEndpoint> {
    // SSRF check
    const allowed = isUrlAllowed(input.url);
    if (!allowed.allowed) {
      throw new Error(`Webhook URL not allowed: ${allowed.reason}`);
    }

    // Validate URL reachable? (optional, for Phase 4 we skip actual fetch, just validate format)
    const secret = input.secret ?? randomBytes(32).toString("hex");

    return this.store.createEndpoint({
      url: input.url,
      secret,
      events: input.events ?? ["*"],
      isActive: true,
      organizationId: input.organizationId,
      projectId: input.projectId,
      headers: input.headers,
      timeoutMs: 10000,
      maxRetries: 3,
    });
  }

  async listEndpoints(filter?: { organizationId?: string; projectId?: string }): Promise<WebhookEndpoint[]> {
    return this.store.listEndpoints(filter);
  }

  async deleteEndpoint(id: string): Promise<void> {
    const deleted = await this.store.deleteEndpoint(id);
    if (!deleted) throw new Error(`Webhook ${id} not found`);
  }

  async deliver(eventType: string, payload: Record<string, unknown>, opts: { organizationId?: string; projectId?: string } = {}): Promise<WebhookDelivery[]> {
    const endpoints = await this.store.listEndpoints({
      organizationId: opts.organizationId,
      projectId: opts.projectId,
      isActive: true,
    });

    const matching = endpoints.filter((e) => e.events.includes("*") || e.events.includes(eventType));

    const deliveries: WebhookDelivery[] = [];

    for (const endpoint of matching) {
      const delivery = await this.deliverToEndpoint(endpoint, eventType, payload);
      deliveries.push(delivery);
    }

    return deliveries;
  }

  private async deliverToEndpoint(endpoint: WebhookEndpoint, eventType: string, payload: Record<string, unknown>): Promise<WebhookDelivery> {
    const id = generateId("whd");
    const now = nowIso();
    const eventId = generateId("evt");

    // Add idempotency key and timestamp
    const enrichedPayload = {
      id: eventId,
      type: eventType,
      timestamp: now,
      data: payload,
      idempotencyKey: `${eventId}:${endpoint.id}`,
    };

    const payloadStr = JSON.stringify(enrichedPayload);
    const signature = signPayload(payloadStr, endpoint.secret);

    let delivery: WebhookDelivery = {
      id,
      webhookId: endpoint.id,
      eventId,
      eventType,
      url: endpoint.url,
      payload: enrichedPayload,
      attempt: 1,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };

    await this.store.saveDelivery(delivery);

    // Attempt delivery with retries
    for (let attempt = 1; attempt <= endpoint.maxRetries + 1; attempt++) {
      delivery.attempt = attempt;
      delivery.updatedAt = nowIso();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), endpoint.timeoutMs);

        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-AgentMesh-Event": eventType,
            "X-AgentMesh-Signature": signature,
            "X-AgentMesh-Delivery": id,
            "X-AgentMesh-Timestamp": Date.now().toString(),
            "Idempotency-Key": enrichedPayload.idempotencyKey,
            ...endpoint.headers,
          },
          body: payloadStr,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const body = await res.text().catch(() => "");

        delivery.responseStatus = res.status;
        delivery.responseBody = body.slice(0, 2000);

        if (res.ok) {
          delivery.status = "SUCCESS";
          await this.store.saveDelivery(delivery);
          console.log(`[webhooks] delivered ${eventType} to ${endpoint.url} attempt ${attempt} status ${res.status}`);
          return delivery;
        } else {
          throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
        }
      } catch (err) {
        const errorMsg = (err as Error).message;
        delivery.error = errorMsg;
        delivery.status = attempt <= endpoint.maxRetries ? "RETRYING" : "FAILED";

        console.warn(`[webhooks] delivery ${id} attempt ${attempt} failed: ${errorMsg}`);

        if (attempt <= endpoint.maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 30000);
          delivery.nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
          await this.store.saveDelivery(delivery);
          await new Promise((r) => setTimeout(r, backoffMs));
        } else {
          // Dead letter after max retries
          if (attempt > endpoint.maxRetries) {
            delivery.status = "DEAD_LETTER";
          }
          await this.store.saveDelivery(delivery);
        }
      }
    }

    return delivery;
  }

  async getDelivery(id: string): Promise<WebhookDelivery | null> {
    return this.store.getDelivery(id);
  }

  async listDeliveries(webhookId?: string): Promise<WebhookDelivery[]> {
    return this.store.listDeliveries(webhookId);
  }

  // For testing: validate incoming webhook
  validateIncoming(payload: string, signature: string, secret: string): boolean {
    return verifySignature(payload, signature, secret);
  }
}

let managerInstance: WebhookManager | null = null;

export function getWebhookManager(): WebhookManager {
  if (!managerInstance) managerInstance = new WebhookManager();
  return managerInstance;
}

export function createWebhookManager(): WebhookManager {
  return new WebhookManager();
}
