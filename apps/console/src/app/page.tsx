import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

export default async function OverviewPage() {
  let health: any = null;
  let info: any = null;
  let agents: any = { agents: [], total: 0 };
  let tasks: any = { tasks: [], total: 0 };

  try {
    health = await api.controlPlane.health();
  } catch {}
  try {
    info = await api.controlPlane.info();
  } catch {}
  try {
    agents = await api.controlPlane.agents.list({ limit: "100" });
  } catch {}
  try {
    tasks = await api.controlPlane.tasks.list({ limit: "100" });
  } catch {}

  const stats = [
    {
      label: "Agents",
      value: agents.total ?? agents.agents?.length ?? 0,
      desc: "Registered agents",
    },
    { label: "Tasks", value: tasks.total ?? tasks.tasks?.length ?? 0, desc: "Total tasks" },
    { label: "Version", value: health?.version ?? "0.1.0-phase4", desc: "Control Plane" },
    { label: "Status", value: health?.status ?? "unknown", desc: "System health" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Overview</h1>
        <p className="text-muted-foreground">AgentMesh Infrastructure Gateway and Control Plane</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Control Plane</CardTitle>
            <CardDescription>Registry, Policies, Identity, Artifacts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Service</span>
              <Badge>{health?.service ?? "control-plane"}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Version</span>
              <span>{health?.version ?? "phase4"}</span>
            </div>
            <div className="flex justify-between">
              <span>Registry</span>
              <Badge variant="secondary">Phase 1+3</Badge>
            </div>
            <div className="flex justify-between">
              <span>Tasks</span>
              <Badge variant="secondary">Phase 2+3+4</Badge>
            </div>
            <div className="flex justify-between">
              <span>Events</span>
              <Badge variant="secondary">NATS JetStream</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Plane</CardTitle>
            <CardDescription>Gateway, Routing, Streaming, Reliability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Gateway</span>
              <Badge>Active</Badge>
            </div>
            <div className="flex justify-between">
              <span>Routing</span>
              <span>5 strategies</span>
            </div>
            <div className="flex justify-between">
              <span>Reliability</span>
              <span>CircuitBreaker, Bulkhead</span>
            </div>
            <div className="flex justify-between">
              <span>Security</span>
              <span>Auth, RateLimit, Policy</span>
            </div>
            <div className="flex justify-between">
              <span>Observability</span>
              <span>OTel + Tracing</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Architecture</CardTitle>
          <CardDescription>Control Plane / Data Plane Separation</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-4 rounded overflow-auto">
            {`User -> Gateway Cluster (Data Plane)
  -> Routing Engine (capability_match, round_robin, etc)
  -> Circuit Breaker / Bulkhead / Rate Limiter
  -> A2A Proxy -> Agent

Control Plane (Registry, Policies, Identity, Artifacts, Messages, Webhooks, MCP Bridge)
  -> Postgres (source of truth)
  -> Redis (cache, health, rate limiting, coordination)
  -> NATS JetStream (event bus, task queue)
  -> S3 (artifacts)

Observability: OTel traces User -> Agent A -> Agent B -> Tool
`}
          </pre>
        </CardContent>
      </Card>

      {info?.features && (
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {info.features.map((f: string) => (
                <Badge key={f} variant="outline">
                  {f}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
