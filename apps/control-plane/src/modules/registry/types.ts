import type { AgentCard } from "@agentmesh/a2a-protocol";

export interface RegisterAgentInput {
  name?: string;
  description?: string;
  url: string;
  version?: string;
  providerOrganization?: string;
  trustLevel?: "UNTRUSTED" | "EXTERNAL" | "VERIFIED" | "ORGANIZATION" | "SYSTEM";
  region?: string;
  environment?: "development" | "staging" | "production";
  tags?: string[];
  metadata?: Record<string, unknown>;
  organizationId?: string;
  projectId?: string;
  card?: AgentCard;
  fetchCard?: boolean;
  ttlSeconds?: number;
}

export interface AgentFilter {
  skill?: string;
  capability?: string;
  name?: string;
  region?: string;
  environment?: string;
  trustLevel?: string;
  health?: string;
  tags?: string[];
  organizationId?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
  search?: string;
  version?: string; // exact version match
  versionStrategy?: "latest" | "stable" | "canary" | "minimum" | "specific" | "max_satisfying";
  minVersion?: string;
  versionRange?: string; // semver range
}

export interface AgentRecord {
  id: string;
  organizationId?: string | null;
  projectId?: string | null;
  name: string;
  description?: string | null;
  version: string;
  url: string;
  providerOrganization?: string | null;
  trustLevel: string;
  health: string;
  region?: string | null;
  environment?: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string | null;
  ttlSeconds?: number | null;
  skills?: Array<{ skillId: string; name: string; description?: string; tags: string[] }>;
  card?: AgentCard | null;
}
