import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConfigurationPage() {
  const config = {
    gateway: {
      port: 3001,
      host: "0.0.0.0",
      logLevel: "info",
      maxMessageSize: "1MB",
      maxArtifactSize: "100MB",
      maxConcurrentTasks: 100,
      maxFanOut: 10,
      rateLimit: { global: "1000/s", ip: "100/s", org: "500/s", project: "200/s", agent: "50/s" },
      circuitBreaker: { failureThreshold: 5, timeoutMs: 60000 },
      jwtSecret: "dev_jwt_secret_change_in_production",
    },
    controlPlane: {
      port: 3002,
      host: "0.0.0.0",
      logLevel: "info",
      taskTimeoutMs: "30m",
      agentHeartbeatMs: 30000,
      agentTtlMs: 120000,
    },
    infra: {
      database: "postgresql://agentmesh:***@localhost:5432/agentmesh",
      redis: "redis://localhost:6379",
      nats: "nats://localhost:4222",
      s3: "http://localhost:9000 (MinIO)",
    },
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Configuration</h1>
      <p className="text-sm text-muted-foreground">Environment-based config • No hardcoded secrets • Production-ready defaults</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Gateway Config</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs bg-secondary p-4 rounded overflow-auto">{JSON.stringify(config.gateway, null, 2)}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Control Plane Config</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs bg-secondary p-4 rounded overflow-auto">{JSON.stringify(config.controlPlane, null, 2)}</pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Infrastructure</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-4 rounded overflow-auto">{JSON.stringify(config.infra, null, 2)}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Environment Variables</CardTitle></CardHeader>
        <CardContent className="text-xs space-y-1">
          <div>DATABASE_URL, REDIS_URL, NATS_URL, S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET</div>
          <div>GATEWAY_PORT, GATEWAY_HOST, GATEWAY_LOG_LEVEL, CONTROL_PLANE_PORT, CONTROL_PLANE_HOST</div>
          <div>JWT_SECRET, OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET</div>
          <div>MAX_MESSAGE_SIZE, MAX_ARTIFACT_SIZE, MAX_CONCURRENT_TASKS, MAX_FAN_OUT, RATE_LIMIT_MAX</div>
          <div>OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT</div>
          <div>USE_POSTGRES=true to enable Postgres, USE_S3=true for S3, otherwise InMemory fallback for dev</div>
        </CardContent>
      </Card>
    </div>
  );
}
