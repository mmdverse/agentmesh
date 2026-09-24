const CONTROL_PLANE_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || process.env.CONTROL_PLANE_URL || "http://localhost:3002";
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || process.env.GATEWAY_URL || "http://localhost:3001";

async function fetchApi(base: string, path: string, opts: RequestInit = {}): Promise<any> {
  const url = `${base.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers as any) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export const api = {
  controlPlane: {
    health: () => fetchApi(CONTROL_PLANE_URL, "/v1/health"),
    info: () => fetchApi(CONTROL_PLANE_URL, "/v1/info"),
    agents: {
      list: (params?: Record<string, string>) => {
        const q = params ? `?${new URLSearchParams(params).toString()}` : "";
        return fetchApi(CONTROL_PLANE_URL, `/v1/agents${q}`);
      },
      get: (id: string) => fetchApi(CONTROL_PLANE_URL, `/v1/agents/${id}`),
      getCard: (id: string) => fetchApi(CONTROL_PLANE_URL, `/v1/agents/${id}/card`),
      versions: (name: string) => fetchApi(CONTROL_PLANE_URL, `/v1/agents/versions/${encodeURIComponent(name)}`),
      discover: (params?: Record<string, string>) => {
        const q = params ? `?${new URLSearchParams(params).toString()}` : "";
        return fetchApi(CONTROL_PLANE_URL, `/v1/agents/discover${q}`);
      },
    },
    tasks: {
      list: (params?: Record<string, string>) => {
        const q = params ? `?${new URLSearchParams(params).toString()}` : "";
        return fetchApi(CONTROL_PLANE_URL, `/v1/tasks${q}`);
      },
      get: (id: string) => fetchApi(CONTROL_PLANE_URL, `/v1/tasks/${id}`),
      history: (id: string) => fetchApi(CONTROL_PLANE_URL, `/v1/tasks/${id}/history`),
      graph: (id: string) => fetchApi(CONTROL_PLANE_URL, `/v1/tasks/${id}/graph`),
      reliability: () => fetchApi(CONTROL_PLANE_URL, `/v1/tasks/reliability/stats`),
    },
    artifacts: {
      list: (params?: Record<string, string>) => {
        const q = params ? `?${new URLSearchParams(params).toString()}` : "";
        return fetchApi(CONTROL_PLANE_URL, `/v1/artifacts${q}`);
      },
      get: (id: string) => fetchApi(CONTROL_PLANE_URL, `/v1/artifacts/${id}`),
    },
    messages: {
      list: (params?: Record<string, string>) => {
        const q = params ? `?${new URLSearchParams(params).toString()}` : "";
        return fetchApi(CONTROL_PLANE_URL, `/v1/messages${q}`);
      },
    },
    webhooks: {
      list: () => fetchApi(CONTROL_PLANE_URL, `/v1/webhooks`),
      deliveries: () => fetchApi(CONTROL_PLANE_URL, `/v1/webhooks/deliveries`),
    },
    mcp: {
      servers: () => fetchApi(CONTROL_PLANE_URL, `/v1/mcp/servers`),
      discover: (skill?: string) => fetchApi(CONTROL_PLANE_URL, `/v1/mcp/discover${skill ? `?skill=${skill}` : ""}`),
    },
    observability: {
      traces: (traceId: string) => fetchApi(CONTROL_PLANE_URL, `/v1/observability/traces/${traceId}`),
      metrics: (name?: string) => fetchApi(CONTROL_PLANE_URL, `/v1/observability/metrics${name ? `?name=${name}` : ""}`),
      spans: () => fetchApi(CONTROL_PLANE_URL, `/v1/observability/spans`),
    },
  },
  gateway: {
    health: () => fetchApi(GATEWAY_URL, "/v1/health"),
    info: () => fetchApi(GATEWAY_URL, "/v1/info"),
    route: (body: any) => fetchApi(GATEWAY_URL, "/v1/route", { method: "POST", body: JSON.stringify(body) }),
    reliability: () => fetchApi(GATEWAY_URL, "/v1/reliability/stats"),
    observability: {
      traces: (traceId: string) => fetchApi(GATEWAY_URL, `/v1/observability/traces/${traceId}`),
      metrics: (name?: string) => fetchApi(GATEWAY_URL, `/v1/observability/metrics${name ? `?name=${name}` : ""}`),
    },
  },
};
