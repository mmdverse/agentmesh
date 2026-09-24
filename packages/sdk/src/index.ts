// AgentMesh Client SDK - Phase 4 full-featured

export interface AgentMeshClientConfig {
  endpoint: string;
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
  versionStrategy?: "latest" | "stable" | "canary" | "minimum" | "specific" | "max_satisfying";
  minVersion?: string;
  versionRange?: string;
  region?: string;
  tags?: string[];
  limit?: number;
}

export interface TaskCreateRequest {
  agentId: string;
  message: { text: string; role?: "user" | "agent"; parts?: any[] };
  contextId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  parentTaskId?: string;
  delegationId?: string;
}

export interface AgentMeshTask {
  id: string;
  state: string;
  agentId: string;
  contextId: string;
  sessionId: string;
  traceId: string;
  rootTaskId: string;
  parentTaskId?: string | null;
  input?: any;
  output?: any;
  error?: any;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactCreateRequest {
  name?: string;
  description?: string;
  contentType: string;
  data?: string; // base64 or text
  jsonData?: Record<string, unknown>;
  taskId?: string;
  agentId?: string;
  retentionDays?: number;
  accessControl?: "private" | "public" | "organization" | "project";
  tags?: string[];
}

export interface MessageSendRequest {
  sender: string;
  receiver: string;
  taskId?: string;
  contextId?: string;
  sessionId?: string;
  contentType?: "text" | "json" | "binary";
  content: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  deliveryMode?: "sync" | "async" | "streaming";
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

  private async gatewayRequest<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const endpoint = this.config.gatewayEndpoint ?? this.config.endpoint;
    const url = `${endpoint.replace(/\/$/, "")}${path}`;
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
      throw new Error(`AgentMesh Gateway API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  discovery = {
    find: async (filter: DiscoveryFilter) => {
      const params = new URLSearchParams();
      if (filter.skill) params.set("skill", filter.skill);
      if (filter.capability) params.set("capability", filter.capability);
      if (filter.version) params.set("version", filter.version);
      if (filter.versionStrategy) params.set("versionStrategy", filter.versionStrategy);
      if (filter.minVersion) params.set("minVersion", filter.minVersion);
      if (filter.versionRange) params.set("versionRange", filter.versionRange);
      if (filter.region) params.set("region", filter.region);
      if (filter.limit) params.set("limit", String(filter.limit));
      return this.request<{ agents: any[]; total: number }>(`/v1/agents?${params.toString()}`);
    },
    discoverBest: async (skill: string, versionStrategy?: string, version?: string) => {
      const params = new URLSearchParams({ skill });
      if (versionStrategy) params.set("versionStrategy", versionStrategy);
      if (version) params.set("version", version);
      return this.request<{ agents: any[] }>(`/v1/agents/discover?${params.toString()}`);
    },
    versions: async (name: string) => {
      return this.request<{ name: string; versions: string[]; agents: any[] }>(`/v1/agents/versions/${encodeURIComponent(name)}`);
    },
  };

  agents = {
    list: async (filter?: DiscoveryFilter) => {
      const params = new URLSearchParams();
      if (filter?.skill) params.set("skill", filter.skill);
      if (filter?.limit) params.set("limit", String(filter.limit));
      return this.request<{ agents: any[]; total: number }>(`/v1/agents?${params.toString()}`);
    },
    get: async (id: string) => this.request<{ agent: any }>(`/v1/agents/${id}`),
    getCard: async (id: string) => this.request<any>(`/v1/agents/${id}/card`),
    register: async (input: any) => this.request<{ agent: any }>(`/v1/agents`, { method: "POST", body: JSON.stringify(input) }),
    delete: async (id: string) => this.request<{ success: boolean }>(`/v1/agents/${id}`, { method: "DELETE" }),
    health: async (id: string) => this.request<{ health: string }>(`/v1/agents/${id}/health`),
    heartbeat: async (id: string) => this.request<{ success: boolean }>(`/v1/agents/${id}/heartbeat`, { method: "POST" }),
  };

  tasks = {
    create: async (req: TaskCreateRequest) => this.request<{ task: AgentMeshTask }>(`/v1/tasks`, { method: "POST", body: JSON.stringify(req) }),
    get: async (id: string) => this.request<{ task: AgentMeshTask }>(`/v1/tasks/${id}`),
    list: async (filter?: { agentId?: string; state?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (filter?.agentId) params.set("agentId", filter.agentId);
      if (filter?.state) params.set("state", filter.state);
      if (filter?.limit) params.set("limit", String(filter.limit));
      return this.request<{ tasks: AgentMeshTask[]; total: number }>(`/v1/tasks?${params.toString()}`);
    },
    cancel: async (id: string, reason?: string) => this.request<{ task: AgentMeshTask }>(`/v1/tasks/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
    complete: async (id: string, output?: any) => this.request<{ task: AgentMeshTask }>(`/v1/tasks/${id}/complete`, { method: "POST", body: JSON.stringify({ output }) }),
    fail: async (id: string, error: { code: string; message: string }) => this.request<{ task: AgentMeshTask }>(`/v1/tasks/${id}/fail`, { method: "POST", body: JSON.stringify({ error }) }),
    retry: async (id: string) => this.request<{ task: AgentMeshTask }>(`/v1/tasks/${id}/retry`, { method: "POST" }),
    history: async (id: string) => this.request<{ taskId: string; history: any[] }>(`/v1/tasks/${id}/history`),
    graph: async (id: string) => this.request<{ taskId: string; tree: any[]; graph: any }>(`/v1/tasks/${id}/graph`),
    stream: (id: string, onEvent: (event: string, data: any) => void): EventSource => {
      const endpoint = this.config.gatewayEndpoint ?? this.config.endpoint;
      const url = `${endpoint.replace(/\/$/, "")}/v1/tasks/${id}/stream`;
      const es = new EventSource(url);
      es.addEventListener("task", (e: any) => onEvent("task", JSON.parse(e.data)));
      es.addEventListener("state", (e: any) => onEvent("state", JSON.parse(e.data)));
      es.addEventListener("completed", (e: any) => onEvent("completed", JSON.parse(e.data)));
      es.addEventListener("failed", (e: any) => onEvent("failed", JSON.parse(e.data)));
      return es;
    },
    // Polling fallback for environments without EventSource
    poll: async (id: string, opts: { intervalMs?: number; timeoutMs?: number } = {}): Promise<AgentMeshTask> => {
      const interval = opts.intervalMs ?? 1000;
      const timeout = opts.timeoutMs ?? 30000;
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const { task } = await this.request<{ task: AgentMeshTask }>(`/v1/tasks/${id}`);
        if (["COMPLETED", "FAILED", "CANCELED", "REJECTED", "TIMEOUT"].includes(task.state)) {
          return task;
        }
        await new Promise((r) => setTimeout(r, interval));
      }
      throw new Error(`Task ${id} polling timeout after ${timeout}ms`);
    },
  };

  artifacts = {
    create: async (req: ArtifactCreateRequest) => this.request<{ artifact: any }>(`/v1/artifacts`, { method: "POST", body: JSON.stringify(req) }),
    get: async (id: string) => this.request<{ artifact: any }>(`/v1/artifacts/${id}`),
    getData: async (id: string): Promise<Buffer> => {
      const url = `${this.config.endpoint.replace(/\/$/, "")}/v1/artifacts/${id}/data`;
      const headers: Record<string, string> = {};
      if (this.config.apiKey) headers["Authorization"] = `Bearer ${this.config.apiKey}`;
      if (this.config.organizationId) headers["X-Organization-Id"] = this.config.organizationId;
      if (this.config.projectId) headers["X-Project-Id"] = this.config.projectId;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(this.config.timeoutMs!) });
      if (!res.ok) throw new Error(`Failed to get artifact data: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return buf;
    },
    list: async (filter?: { taskId?: string; agentId?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (filter?.taskId) params.set("taskId", filter.taskId);
      if (filter?.agentId) params.set("agentId", filter.agentId);
      if (filter?.limit) params.set("limit", String(filter.limit));
      return this.request<{ artifacts: any[]; total: number }>(`/v1/artifacts?${params.toString()}`);
    },
    delete: async (id: string) => this.request<{ success: boolean }>(`/v1/artifacts/${id}`, { method: "DELETE" }),
    presignedUrl: async (id: string) => this.request<{ url: string; metadata: any }>(`/v1/artifacts/${id}/url`),
  };

  messages = {
    send: async (req: MessageSendRequest) => this.request<{ message: any }>(`/v1/messages`, { method: "POST", body: JSON.stringify(req) }),
    get: async (id: string) => this.request<{ message: any }>(`/v1/messages/${id}`),
    list: async (filter?: { taskId?: string; contextId?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (filter?.taskId) params.set("taskId", filter.taskId);
      if (filter?.contextId) params.set("contextId", filter.contextId);
      if (filter?.limit) params.set("limit", String(filter.limit));
      return this.request<{ messages: any[]; total: number }>(`/v1/messages?${params.toString()}`);
    },
    ack: async (id: string, receiver: string) => this.request<{ success: boolean }>(`/v1/messages/${id}/ack`, { method: "POST", body: JSON.stringify({ receiver }) }),
  };

  webhooks = {
    register: async (input: { url: string; events?: string[]; secret?: string }) => this.request<{ webhook: any }>(`/v1/webhooks`, { method: "POST", body: JSON.stringify(input) }),
    list: async () => this.request<{ webhooks: any[] }>(`/v1/webhooks`),
    delete: async (id: string) => this.request<{ success: boolean }>(`/v1/webhooks/${id}`, { method: "DELETE" }),
    deliveries: async (webhookId?: string) => {
      const path = webhookId ? `/v1/webhooks/${webhookId}/deliveries` : `/v1/webhooks/deliveries`;
      return this.request<{ deliveries: any[] }>(path);
    },
    test: async (eventType?: string, payload?: any) => this.request<{ deliveries: any[] }>(`/v1/webhooks/test`, { method: "POST", body: JSON.stringify({ eventType, payload }) }),
  };

  mcp = {
    listServers: async () => this.request<{ servers: any[] }>(`/v1/mcp/servers`),
    discover: async (skill?: string) => {
      const params = skill ? `?skill=${encodeURIComponent(skill)}` : "";
      return this.request<{ agents: any[] }>(`/v1/mcp/discover${params}`);
    },
    registerServer: async (input: { name: string; endpoint: string; tools?: any[] }) => this.request<{ name: string; card: any }>(`/v1/mcp/servers`, { method: "POST", body: JSON.stringify(input) }),
    callTool: async (serverName: string, toolName: string, args?: any) => this.request<{ result: any }>(`/v1/mcp/servers/${encodeURIComponent(serverName)}/tools/${encodeURIComponent(toolName)}/call`, { method: "POST", body: JSON.stringify({ args }) }),
  };

  observability = {
    getTrace: async (traceId: string) => this.request<{ traceId: string; spans: any[] }>(`/v1/observability/traces/${traceId}`),
    getMetrics: async (name?: string) => {
      const params = name ? `?name=${encodeURIComponent(name)}` : "";
      return this.request<{ metrics: any[] }>(`/v1/observability/metrics${params}`);
    },
    getSpans: async () => this.request<{ spans: any[] }>(`/v1/observability/spans`),
  };

  health = {
    check: async () => this.request<{ status: string; version: string }>(`/v1/health`),
    gateway: async () => this.gatewayRequest<{ status: string; version: string }>(`/v1/health`),
  };

  // Gateway routing
  gateway = {
    route: async (input: { skill?: string; capability?: string; region?: string; strategy?: string }) => this.gatewayRequest<{ agent: any; candidates: any[] }>(`/v1/route`, { method: "POST", body: JSON.stringify(input) }),
    invoke: async (agentId: string, rpc: { method: string; params?: any }) => this.gatewayRequest<any>(`/v1/agents/${agentId}/invoke`, { method: "POST", body: JSON.stringify(rpc) }),
  };
}

export function createClient(config: AgentMeshClientConfig): AgentMeshClient {
  return new AgentMeshClient(config);
}

// Re-export for convenience
export type { AgentMeshClientConfig as ClientConfig };
