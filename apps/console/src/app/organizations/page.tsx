import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrganizationsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Organizations & Projects</h1>
      <p className="text-sm text-muted-foreground">
        Multi-Tenancy • Organization → Projects → Agents/Tasks/Policies/Credentials • Strict
        Isolation
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Hierarchy</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-4 rounded">
            {`Organization (org_123)
  +-- Project A (proj_a)
  |    +-- Agents: CodeAgent v1, v2, v2.1-canary
  |    +-- Tasks: task_abc, task_def
  |    +-- Policies: allow_org_agents
  |    +-- Credentials: api_key_123
  +-- Project B (proj_b)
       +-- Agents: DataAgent
       +-- Tasks: ...

Tenant Isolation:
- Organization mismatch → 403
- Project mismatch → 403 (unless allowCrossProject)
- Extracted from: X-Organization-Id, X-Project-Id headers, query, body, JWT claims
- Enforced in: Registry, Tasks, Artifacts, Messages, Webhooks

Headers:
X-Organization-Id: org_123
X-Project-Id: proj_a
`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Versioning per Tenant</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div>Same agent name can have multiple versions per tenant:</div>
          <pre className="bg-secondary p-2 rounded text-xs">
            {`CodeAgent v1.0.0 (org_123/proj_a)
CodeAgent v2.0.0 (org_123/proj_a)
CodeAgent v2.1.0-canary (org_123/proj_a)

Resolution strategies:
- latest: max semver
- stable: latest without prerelease/canary
- canary: latest canary
- specific: exact version
- minimum: min satisfying
- max_satisfying: semver range ^1.0.0, ~2.0.0, >=1.0.0 <2.0.0
`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
