import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProjectsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Projects</h1>
      <p className="text-sm text-muted-foreground">Organization → Projects • Tenant Isolation • Versioning per Project</p>

      <Card>
        <CardHeader><CardTitle>Multi-Tenancy Model</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-4 rounded">
{`Organization (e.g., org_123)
  name: "Acme Corp"
  slug: "acme"

  Project A (proj_a)
    organizationId: org_123
    slug: "project-a"
    name: "Code Review Agents"

    Agents:
      - CodeAgent v1.0.0
      - CodeAgent v2.0.0
      - CodeAgent v2.1.0-canary

    Tasks:
      - task_abc (CodeAgent v2.0.0)
      - task_def (CodeAgent v1.0.0)

    Policies:
      - allow_org_agents (priority 50)
      - deny_untrusted_prod_deploy (priority 100)

  Project B (proj_b)
    Agents: DataAgent v1.0.0
    Tasks: ...

Isolation:
- Strict: org mismatch → 403, project mismatch → 403
- Headers: X-Organization-Id, X-Project-Id
- Enforcement: Registry, Tasks, Artifacts, Messages, Webhooks, MCP
- Super-admin: can bypass with identity in superAdminIdentities list
`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
