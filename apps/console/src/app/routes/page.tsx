import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export default async function RoutesPage() {
  let gatewayInfo: any = {};
  let reliability: any = {};
  try {
    gatewayInfo = await api.gateway.info();
  } catch {}
  try {
    reliability = await api.gateway.reliability();
  } catch {}

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Routes & Routing</h1>
      <p className="text-sm text-muted-foreground">
        Routing Engine • Strategies: round_robin, weighted, least_loaded, latency_aware,
        capability_match
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Gateway Info</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-4 rounded overflow-auto">
            {JSON.stringify(gatewayInfo, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reliability Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(reliability, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Routing Test</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>Test routing via API:</p>
          <pre className="bg-secondary p-2 rounded text-xs mt-2">{`POST /v1/route
{
  "skill": "code-review",
  "strategy": "capability_match",
  "region": "us-east-1"
}`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
