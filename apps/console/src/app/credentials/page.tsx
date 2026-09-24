import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CredentialsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Credentials</h1>
      <p className="text-sm text-muted-foreground">
        Security • API Keys, JWT, OIDC, mTLS, Workload Identity
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Authentication Providers</CardTitle>
          <CardDescription>Enterprise-grade auth with pluggable providers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="font-medium">
              API Keys <Badge>Active</Badge>
            </div>
            <div className="text-muted-foreground text-xs">
              Header: X-API-Key or Authorization: Bearer ApiKey_xxx or Bearer xxx
            </div>
            <pre className="bg-secondary p-2 rounded text-xs mt-1">{`curl -H "X-API-Key: your_key" http://localhost:3002/v1/agents`}</pre>
          </div>
          <div>
            <div className="font-medium">
              JWT <Badge>Active</Badge>
            </div>
            <div className="text-muted-foreground text-xs">
              HS256 with secret JWT_SECRET, issuer/audience validation
            </div>
            <pre className="bg-secondary p-2 rounded text-xs mt-1">{`Authorization: Bearer <jwt>`}</pre>
          </div>
          <div>
            <div className="font-medium">
              OIDC <Badge>Active</Badge>
            </div>
            <div className="text-muted-foreground text-xs">
              JWKS remote verification via OIDC_ISSUER/.well-known/jwks.json
            </div>
          </div>
          <div>
            <div className="font-medium">
              mTLS <Badge>Active</Badge>
            </div>
            <div className="text-muted-foreground text-xs">
              Client cert CN extraction, CA verification in production
            </div>
          </div>
          <div>
            <div className="font-medium">
              Workload Identity <Badge>Active</Badge>
            </div>
            <div className="text-muted-foreground text-xs">
              X-Workload-Identity header for K8s/GCP/AWS service accounts
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          <div>• Avoid long-lived credentials, use short-lived JWT</div>
          <div>• Rotate API keys regularly</div>
          <div>• Use mTLS for agent-to-agent</div>
          <div>• Workload Identity for K8s pods</div>
          <div>• All secrets via env, not hardcoded</div>
        </CardContent>
      </Card>
    </div>
  );
}
