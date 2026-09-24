import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PoliciesPage() {
  const policies = [
    { id: "allow_all_dev", name: "Allow All (Dev)", effect: "allow", subjects: ["*"], resources: ["*"], actions: ["*"], priority: -100 },
    { id: "deny_untrusted_prod_deploy", name: "Deny Untrusted Prod Deploy", effect: "deny", resources: ["environment:production", "skill:production.deploy"], conditions: { trustLevel: ["UNTRUSTED", "EXTERNAL"] }, priority: 100 },
    { id: "allow_org_agents", name: "Allow Organization Agents", effect: "allow", subjects: ["agent:*"], resources: ["agent:*", "skill:*", "task:*"], actions: ["agent:read", "skill:invoke", "task:create"], priority: 50 },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Policies</h1>
      <p className="text-sm text-muted-foreground">Authorization • RBAC/ABAC • Least Privilege • Delegation Chain</p>

      <div className="grid gap-4">
        {policies.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex justify-between">
                <span>{p.name}</span>
                <Badge variant={p.effect === "allow" ? "default" : "destructive"}>{p.effect}</Badge>
              </CardTitle>
              <CardDescription>ID: {p.id} • Priority: {p.priority}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <div>Subjects: {p.subjects?.join(", ") ?? "any"}</div>
              <div>Resources: {p.resources?.join(", ") ?? (p as any).resources?.join(", ") ?? "any"}</div>
              <div>Actions: {(p as any).actions?.join(", ") ?? "any"}</div>
              {(p as any).conditions && <div>Conditions: {JSON.stringify((p as any).conditions)}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Delegation Example</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-4 rounded">
{`User -> MainAgent -> ResearchAgent -> DataAgent
Each delegation explicit with:
- scopes: [research.read]
- audience: agent id
- expiration: ISO
- chain: [parent ids]
- revocation support
- privilege escalation prevention (child scopes subset of parent)
`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
