import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export default async function SecurityPage() {
  let webhooks: any = { webhooks: [] };
  let deliveries: any = { deliveries: [] };
  try {
    webhooks = await api.controlPlane.webhooks.list();
  } catch {}
  try {
    deliveries = await api.controlPlane.webhooks.deliveries();
  } catch {}

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Security Events</h1>
      <p className="text-sm text-muted-foreground">Threat Model • Auth Events • Policy Denials • Webhook Deliveries</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Threat Model Coverage</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            <div>• Malicious agent - Trust levels UNTRUSTED/EXTERNAL/VERIFIED/ORG/SYSTEM</div>
            <div>• Compromised agent - Circuit breaker OPEN, health UNHEALTHY</div>
            <div>• Malicious Agent Card - Schema validation, signature verification, blind trust prevention</div>
            <div>• Spoofed identity - Auth providers with verification</div>
            <div>• Replay - Webhook timestamp tolerance, idempotency keys</div>
            <div>• Task hijacking - Tenant isolation, delegation chain</div>
            <div>• Confused deputy - Explicit delegation with scopes</div>
            <div>• SSRF - URL allowlist, blocked private IPs, metadata endpoints</div>
            <div>• Webhook abuse - Signing, retries, dead-letter</div>
            <div>• Authorization bypass - Policy engine deny-overrides-allow</div>
            <div>• Tenant breakout - Strict isolation enforcement</div>
            <div>• Artifact access violations - Access control private/org/project/public</div>
            <div>• Message injection - Content-type validation, size limits</div>
            <div>• Oversized payloads - 1MB message, 100MB artifact limits</div>
            <div>• Denial of service - Rate limiting multi-dimensional, bulkhead, fan-out limiter</div>
            <div>• Retry storms - Exponential backoff with jitter, circuit breaker</div>
            <div>• Credential leakage - Env-based, no logging</div>
            <div>• Malicious extension - Plugin interface with sandbox</div>
            <div>• Compromised gateway - Horizontal scaling, no central bottleneck</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Webhooks ({webhooks.total ?? webhooks.webhooks?.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {webhooks.webhooks?.map((wh: any) => (
              <div key={wh.id} className="border rounded p-2 text-xs">
                <div>{wh.url}</div>
                <div className="text-muted-foreground">Events: {wh.events?.join(", ")} • Active: {String(wh.isActive)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Deliveries ({deliveries.total ?? deliveries.deliveries?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="space-y-1 max-h-96 overflow-auto">
          {deliveries.deliveries?.slice(-20).map((d: any) => (
            <div key={d.id} className="border rounded p-2 text-xs">
              <div className="flex justify-between"><span>{d.eventType} → {d.url.slice(0, 40)}</span><span className={d.status === "SUCCESS" ? "text-green-600" : d.status === "FAILED" ? "text-red-600" : ""}>{d.status}</span></div>
              <div className="text-muted-foreground">Attempt {d.attempt} • {d.createdAt} • Status: {d.responseStatus ?? "pending"}</div>
              {d.error && <div className="text-red-500">{d.error.slice(0, 200)}</div>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
