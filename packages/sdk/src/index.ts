// Client SDK - Phase 0 minimal, will grow in Phase 4

export interface AgentMeshClientConfig {
  endpoint: string; // control-plane endpoint
  gatewayEndpoint?: string;
  apiKey?: string;
  organizationId?: string;
  projectId?: string;
  timeoutMs?: number;
}

export interface DiscoveryFilter {
  skill?: string;
  capability?: string;
  version?: string;
  region?: string;
  tags?: string[];
  limit?: number;
}

export interface TaskCreateRequest {
  agentId: string;
  message: { text: string; role?: "user" | "agent" };
  contextId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentMeshTask {
  id: string;
  state: string;
  agentId: string;
  contextId: string;
}

export class AgentMeshClient {
  private config: AgentMeshClientConfig;

  constructor(config: AgentMeshClientConfig) {
    this.config = { timeoutMs: 30000, ...config };
  }

  private async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const url = `${this.config.endpoint.replace(/\/$/, "")}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(opts.headers as Record<string, string>),
    };
    if (this.config.apiKey) headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    if (this.config.organizationId) headers["X-Organization-Id"] = this.config.organizationId;
    if (this.config.projectId) headers["X-Project-Id"] = this.config.projectId;

    const res = await fetch(url, { ...opts, headers, signal: AbortSignal.timeout(this.config.timeoutMs!) });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AgentMesh API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  // Discovery
  discovery = {
    find: async (filter: DiscoveryFilter) => {
      const params = new URLSearchParams();
      if (filter.skill) params.set("skill", filter.skill);
      if (filter.capability) params.set("capability", filter.capability);
      if (filter.version) params.set("version", filter.version);
      if (filter.region) params.set("region", filter.region);
      if (filter.limit) params.set("limit", String(filter.limit));
      return this.request<{ agents: any[] }>(`/v1/agents?${params.toString()}`);
    },
  };

  // Agents
  agents = {
    list: async () => this.request<{ agents: any[] }>(`/v1/agents`),
    get: async (id: string) => this.request<{ agent: any }>(`/v1/agents/${id}`),
    getCard: async (id: string) => this.request<any>(`/v1/agents/${id}/card`),
  };

  // Tasks
  tasks = {
    create: async (req: TaskCreateRequest) => this.request<{ task: AgentMeshTask }>(`/v1/tasks`, { method: "POST", body: JSON.stringify(req) }),
    get: async (id: string) => this.request<{ task: AgentMeshTask }>(`/v1/tasks/${id}`),
    cancel: async (id: string) => this.request<{ task: AgentMeshTask }>(`/v1/tasks/${id}/cancel`, { method: "POST" }),
    stream: (id: string) => {
      // Phase 4 will implement SSE
      const url = `${this.config.gatewayEndpoint ?? this.config.endpoint}/v1/tasks/${id}/stream`;
      return new EventSource(url);
    },
  };

  // Health
  health = {
    check: async () => this.request<{ status: string; version: string }>(`/v1/health`),
  };
}

export function createClient(config: AgentMeshClientConfig): AgentMeshClient {
  return new AgentMeshClient(config);
}
