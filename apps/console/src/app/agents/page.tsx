import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import Link from "next/link";

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: { skill?: string; search?: string };
}) {
  let data: any = { agents: [], total: 0 };
  try {
    data = await api.controlPlane.agents.list({
      skill: searchParams.skill,
      search: searchParams.search,
      limit: "100",
    } as any);
  } catch (e) {
    console.warn(e);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Agent Registry</h1>
      <p className="text-sm text-muted-foreground">
        Total: {data.total ?? data.agents?.length ?? 0} agents • Discovery by skill, capability,
        version, region
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.agents?.map((agent: any) => (
          <Card key={agent.id}>
            <CardHeader>
              <CardTitle className="text-base">
                <Link href={`/agents/${agent.id}`} className="hover:underline">
                  {agent.name}
                </Link>
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">{agent.version}</Badge>
                <Badge
                  variant={
                    agent.health === "HEALTHY"
                      ? "default"
                      : agent.health === "UNHEALTHY"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {agent.health}
                </Badge>
                <Badge variant="outline">{agent.trustLevel}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="text-muted-foreground truncate">{agent.description ?? agent.url}</div>
              <div className="text-xs">ID: {agent.id.slice(0, 20)}...</div>
              <div className="text-xs">URL: {agent.url}</div>
              {agent.skills?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {agent.skills.slice(0, 5).map((s: any) => (
                    <Badge key={s.skillId} variant="outline" className="text-[10px]">
                      {s.name}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Org: {agent.organizationId ?? "default"} • Project: {agent.projectId ?? "default"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.agents?.length === 0 && (
        <div className="text-muted-foreground text-sm">
          No agents registered yet. Use API POST /v1/agents to register.
        </div>
      )}
    </div>
  );
}
