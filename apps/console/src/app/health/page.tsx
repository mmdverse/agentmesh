import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

export default async function HealthPage() {
  let controlPlaneHealth: any = {};
  let gatewayHealth: any = {};
  let controlPlaneInfo: any = {};
  let gatewayInfo: any = {};
  let reliability: any = {};

  try {
    controlPlaneHealth = await api.controlPlane.health();
  } catch (e) {
    controlPlaneHealth = { status: "error", error: (e as Error).message };
  }
  try {
    gatewayHealth = await api.gateway.health();
  } catch (e) {
    gatewayHealth = { status: "error", error: (e as Error).message };
  }
  try {
    controlPlaneInfo = await api.controlPlane.info();
  } catch {}
  try {
    gatewayInfo = await api.gateway.info();
  } catch {}
  try {
    reliability = await api.controlPlane.tasks.reliability();
  } catch {}

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">System Health</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Control Plane</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Status</span>
              <Badge variant={controlPlaneHealth.status === "ok" ? "default" : "destructive"}>
                {controlPlaneHealth.status}
              </Badge>
            </div>
            <div>Version: {controlPlaneHealth.version}</div>
            <div>Service: {controlPlaneHealth.service}</div>
            <pre className="text-xs bg-secondary p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(controlPlaneHealth, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gateway (Data Plane)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Status</span>
              <Badge variant={gatewayHealth.status === "ok" ? "default" : "destructive"}>
                {gatewayHealth.status}
              </Badge>
            </div>
            <div>Version: {gatewayHealth.version}</div>
            <div>Service: {gatewayHealth.service}</div>
            <pre className="text-xs bg-secondary p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(gatewayHealth, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Control Plane Info</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(controlPlaneInfo, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gateway Info</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(gatewayInfo, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reliability</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(reliability, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>Postgres: source of truth (InMemory fallback in dev)</div>
          <div>Redis: cache, health, rate limiting, coordination (InMemory fallback)</div>
          <div>NATS JetStream: event bus + task queue (InMemory fallback)</div>
          <div>S3: artifacts (InMemory fallback, MinIO for local)</div>
        </CardContent>
      </Card>
    </div>
  );
}
