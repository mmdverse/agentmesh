import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export default async function TelemetryPage() {
  let spans: any = { spans: [], total: 0 };
  let metrics: any = { metrics: [], total: 0 };
  try {
    spans = await api.controlPlane.observability.spans();
  } catch {}
  try {
    metrics = await api.controlPlane.observability.metrics();
  } catch {}

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Telemetry & Observability</h1>
      <p className="text-sm text-muted-foreground">OpenTelemetry • Trace: User → Agent A → Agent B → Tool • Metrics: latency, errors, retries</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent Spans ({spans.total})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-auto">
            {spans.spans?.slice(-20).map((span: any) => (
              <div key={span.id} className="border rounded p-2 text-xs">
                <div className="font-medium">{span.name} • {span.status} • {span.durationMs}ms</div>
                <div className="text-muted-foreground">Trace: {span.traceId.slice(0, 12)} • ID: {span.id.slice(0, 12)} • Parent: {span.parentSpanId?.slice(0, 12) ?? "root"}</div>
                <div>Attrs: {JSON.stringify(span.attributes).slice(0, 200)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Metrics ({metrics.total})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-auto">
            {metrics.metrics?.slice(-20).map((m: any, i: number) => (
              <div key={i} className="border rounded p-2 text-xs">
                <div className="font-medium">{m.name}: {m.value} • {m.type}</div>
                <div className="text-muted-foreground">Labels: {JSON.stringify(m.labels)} • {new Date(m.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Trace Propagation</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-4 rounded">
{`X-Trace-Id header propagated through:
User (trace_abc)
  -> Gateway (span: http.POST /v1/tasks)
    -> Control-Plane (span: task.create)
      -> Agent A (span: agent.invoke)
        -> Agent B (span: agent.invoke)
          -> Tool (span: tool.search)

Each span: id, traceId, parentSpanId, name, startTime, endTime, durationMs, attributes, status, events

Export: OTel-compatible, OTLP endpoint configurable via OTEL_EXPORTER_OTLP_ENDPOINT
`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
