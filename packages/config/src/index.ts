import { z } from "zod";

// Base schemas
const LogLevelSchema = z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);

const PortSchema = z.coerce.number().int().min(1).max(65535);

const UrlSchema = z.string().url().or(z.string().startsWith("postgresql://")).or(z.string().startsWith("redis://")).or(z.string().startsWith("nats://"));

// Shared infra
export const InfraConfigSchema = z.object({
  DATABASE_URL: z.string().min(1).default("postgresql://agentmesh:agentmesh_secret@localhost:5432/agentmesh"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  NATS_URL: z.string().min(1).default("nats://localhost:4222"),
  S3_ENDPOINT: z.string().min(1).default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().default("minioadmin"),
  S3_SECRET_ACCESS_KEY: z.string().default("minioadmin123"),
  S3_BUCKET: z.string().default("agentmesh-artifacts"),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
});

export type InfraConfig = z.infer<typeof InfraConfigSchema>;

// Gateway config
export const GatewayConfigSchema = InfraConfigSchema.extend({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  GATEWAY_PORT: PortSchema.default(3001),
  GATEWAY_HOST: z.string().default("0.0.0.0"),
  GATEWAY_LOG_LEVEL: LogLevelSchema.default("info"),
  OTEL_SERVICE_NAME: z.string().default("agentmesh-gateway"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  JWT_SECRET: z.string().min(1).default("dev_jwt_secret_change_in_production"),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  MAX_MESSAGE_SIZE: z.coerce.number().default(1024 * 1024), // 1MB
  MAX_ARTIFACT_SIZE: z.coerce.number().default(100 * 1024 * 1024), // 100MB
  REQUEST_TIMEOUT_MS: z.coerce.number().default(30000),
  VERSION: z.string().default("0.1.0-phase0"),
});

export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;

// Control Plane config
export const ControlPlaneConfigSchema = InfraConfigSchema.extend({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CONTROL_PLANE_PORT: PortSchema.default(3002),
  CONTROL_PLANE_HOST: z.string().default("0.0.0.0"),
  CONTROL_PLANE_LOG_LEVEL: LogLevelSchema.default("info"),
  OTEL_SERVICE_NAME: z.string().default("agentmesh-control-plane"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  JWT_SECRET: z.string().min(1).default("dev_jwt_secret_change_in_production"),
  OIDC_ISSUER: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  AGENT_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(30000),
  AGENT_TTL_MS: z.coerce.number().default(120000),
  TASK_TIMEOUT_MS: z.coerce.number().default(1000 * 60 * 30), // 30m
  VERSION: z.string().default("0.1.0-phase0"),
});

export type ControlPlaneConfig = z.infer<typeof ControlPlaneConfigSchema>;

export function loadGatewayConfig(env: Record<string, string | undefined> = process.env): GatewayConfig {
  const parsed = GatewayConfigSchema.safeParse(env);
  if (!parsed.success) {
    console.error("Invalid gateway config:", parsed.error.flatten());
    throw new Error("Invalid gateway config");
  }
  return parsed.data;
}

export function loadControlPlaneConfig(env: Record<string, string | undefined> = process.env): ControlPlaneConfig {
  const parsed = ControlPlaneConfigSchema.safeParse(env);
  if (!parsed.success) {
    console.error("Invalid control-plane config:", parsed.error.flatten());
    throw new Error("Invalid control-plane config");
  }
  return parsed.data;
}

export function isProduction(env: string | undefined): boolean {
  return env === "production";
}
