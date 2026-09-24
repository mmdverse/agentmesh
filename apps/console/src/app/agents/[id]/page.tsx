import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

export default async function AgentDetailPage({ params }: { params: { id: string } }) {
  let agent: any = null;
  let card: any = null;
  try {
    const res = await api.controlPlane.agents.get(params.id);
    agent = res.agent;
  } catch {}
  try {
    const res = await api.controlPlane.agents.getCard(params.id);
    card = res.card;
  } catch {}

  if (!agent) return <div>Agent not found: {params.id}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{agent.name}</h1>
      <div className="flex gap-2">
        <Badge>{agent.version}</Badge>
        <Badge variant={agent.health === "HEALTHY" ? "default" : "destructive"}>
          {agent.health}
        </Badge>
        <Badge variant="outline">{agent.trustLevel}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>ID: {agent.id}</div>
            <div>URL: {agent.url}</div>
            <div>Org: {agent.organizationId ?? "none"}</div>
            <div>Project: {agent.projectId ?? "none"}</div>
            <div>Region: {agent.region ?? "none"}</div>
            <div>Environment: {agent.environment}</div>
            <div>Created: {agent.createdAt}</div>
            <div>Last Seen: {agent.lastSeenAt}</div>
            <div>Description: {agent.description}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
            <CardDescription>{agent.skills?.length ?? 0} skills</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {agent.skills?.map((s: any) => (
              <div key={s.skillId} className="border rounded p-2">
                <div className="font-medium">
                  {s.name}{" "}
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {s.skillId}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">{s.description}</div>
                <div className="flex gap-1 mt-1">
                  {s.tags?.map((t: string) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {card && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Card</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-secondary p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(card, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
