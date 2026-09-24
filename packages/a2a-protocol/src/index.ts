import { z } from "zod";

// A2A Protocol - Based on Google A2A spec (https://google.github.io/A2A/)
// This package is versioned and must remain spec-compliant. No proprietary extensions without extension field.

// Security Schemes - compatible with OpenAPI / A2A HTTP security model
export const SecuritySchemeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("oauth2"),
    flows: z.object({
      authorizationCode: z.object({ authorizationUrl: z.string(), tokenUrl: z.string(), scopes: z.record(z.string()) }).optional(),
      clientCredentials: z.object({ tokenUrl: z.string(), scopes: z.record(z.string()) }).optional(),
    }),
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal("apiKey"),
    in: z.enum(["header", "query", "cookie"]),
    name: z.string(),
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal("http"),
    scheme: z.string(), // bearer, basic
    bearerFormat: z.string().optional(),
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal("openIdConnect"),
    openIdConnectUrl: z.string().url(),
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal("mutualTLS"),
    description: z.string().optional(),
  }),
]);

export type SecurityScheme = z.infer<typeof SecuritySchemeSchema>;

export const AgentSkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  examples: z.array(z.string()).optional(),
  inputModes: z.array(z.string()).optional(),
  outputModes: z.array(z.string()).optional(),
});

export type AgentSkill = z.infer<typeof AgentSkillSchema>;

export const AgentCapabilitySchema = z.object({
  streaming: z.boolean().default(false),
  pushNotifications: z.boolean().default(false),
  stateTransitionHistory: z.boolean().default(false),
  extensions: z.array(z.string()).default([]),
});

export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

export const AgentProviderSchema = z.object({
  organization: z.string().min(1),
  url: z.string().url().optional(),
});

export type AgentProvider = z.infer<typeof AgentProviderSchema>;

// A2A Agent Card - Core metadata
export const AgentCardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  url: z.string().url(), // base URL where agent is reachable
  version: z.string().min(1),
  provider: AgentProviderSchema.optional(),
  iconUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),

  // Supported interfaces
  capabilities: AgentCapabilitySchema.default({}),
  skills: z.array(AgentSkillSchema).default([]),

  // Transports
  defaultInputModes: z.array(z.string()).default(["text"]),
  defaultOutputModes: z.array(z.string()).default(["text"]),

  // Security
  securitySchemes: z.record(SecuritySchemeSchema).optional(),
  security: z.array(z.record(z.array(z.string()))).optional(),

  // Protocol versions supported
  protocolVersions: z.array(z.string()).default(["0.2"]),

  // Additional metadata
  metadata: z.record(z.unknown()).optional(),
});

export type AgentCard = z.infer<typeof AgentCardSchema>;

// Extended card with internal registry fields
export const RegisteredAgentCardSchema = AgentCardSchema.extend({
  id: z.string().min(1),
  trustLevel: z.enum(["UNTRUSTED", "EXTERNAL", "VERIFIED", "ORGANIZATION", "SYSTEM"]).default("UNTRUSTED"),
  health: z.enum(["UNKNOWN", "HEALTHY", "DEGRADED", "UNHEALTHY"]).default("UNKNOWN"),
  region: z.string().optional(),
  environment: z.enum(["development", "staging", "production"]).optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime().optional(),
  ttlSeconds: z.number().int().positive().optional(),
});

export type RegisteredAgentCard = z.infer<typeof RegisteredAgentCardSchema>;

// Messages - A2A JSON-RPC based
export const MessageRoleSchema = z.enum(["user", "agent"]);

export const MessagePartSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("file"), file: z.object({ name: z.string().optional(), mimeType: z.string(), bytes: z.string().optional(), uri: z.string().optional() }) }),
  z.object({ kind: z.literal("data"), data: z.record(z.unknown()) }),
]);

export type MessagePart = z.infer<typeof MessagePartSchema>;

export const MessageSchema = z.object({
  messageId: z.string().min(1),
  role: MessageRoleSchema,
  parts: z.array(MessagePartSchema),
  contextId: z.string().optional(),
  taskId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime().optional(),
});

export type A2AMessage = z.infer<typeof MessageSchema>;

// Task - A2A Task object
export const TaskStatusSchema = z.object({
  state: z.enum(["SUBMITTED", "WORKING", "INPUT_REQUIRED", "AUTH_REQUIRED", "COMPLETED", "FAILED", "CANCELED", "REJECTED", "TIMEOUT"]),
  message: MessageSchema.optional(),
  timestamp: z.string().datetime(),
});

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const ArtifactSchema = z.object({
  artifactId: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
  parts: z.array(MessagePartSchema),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime().optional(),
});

export type A2AArtifact = z.infer<typeof ArtifactSchema>;

export const TaskSchema = z.object({
  id: z.string().min(1),
  contextId: z.string().min(1),
  status: TaskStatusSchema,
  history: z.array(MessageSchema).default([]),
  artifacts: z.array(ArtifactSchema).default([]),
  metadata: z.record(z.unknown()).optional(),
});

export type A2ATask = z.infer<typeof TaskSchema>;

// JSON-RPC envelope for A2A
export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.record(z.unknown()).optional(),
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.unknown().optional(),
  error: z.object({ code: z.number(), message: z.string(), data: z.unknown().optional() }).optional(),
});

export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

// Validation helpers
export function validateAgentCard(data: unknown): { success: true; data: AgentCard } | { success: false; error: z.ZodError } {
  const result = AgentCardSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

export function parseAgentCardOrThrow(data: unknown): AgentCard {
  return AgentCardSchema.parse(data);
}

// Well-known discovery
export const WELL_KNOWN_AGENT_CARD_PATH = "/.well-known/agent.json";
export const WELL_KNOWN_A2A_PATH = "/.well-known/a2a.json";

export function buildWellKnownUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  return `${url.origin}${WELL_KNOWN_AGENT_CARD_PATH}`;
}

// Protocol version negotiation
export const SUPPORTED_A2A_VERSIONS = ["0.2", "0.1"] as const;
export type SupportedA2AVersion = (typeof SUPPORTED_A2A_VERSIONS)[number];

export function negotiateProtocolVersion(requested: string[], supported: readonly string[] = SUPPORTED_A2A_VERSIONS): string | null {
  for (const v of requested) {
    if ((supported as readonly string[]).includes(v)) return v;
  }
  return null;
}
