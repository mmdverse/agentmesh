import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

export default async function MCPPage() {
  let servers: any = { servers: [] };
  try {
    servers = await api.controlPlane.mcp.servers();
  } catch {}

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">MCP Bridge</h1>
      <p className="text-sm text-muted-foreground">
        A2A Agent | AgentMesh | MCP Server/Tool • MCP Agent | AgentMesh | A2A Agent
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Protocol Separation</CardTitle>
          <CardDescription>MCP and A2A kept separate with clear abstraction</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-4 rounded">
            {`A2A Agent -> AgentMesh Gateway -> MCP Bridge -> MCP Server/Tool
MCP Tool -> AgentMesh -> A2A Agent

Translation:
- MCP Tool -> A2A Skill (id: mcp_{tool.name}, tags: [mcp, tool])
- MCP Server -> A2A Agent Card
- A2A Skill -> MCP Tool (inputSchema with message, context)
`}
          </pre>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {servers.servers?.map((s: any) => (
          <Card key={s.serverName}>
            <CardHeader>
              <CardTitle>{s.serverName}</CardTitle>
              <CardDescription>{s.card?.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">Version: {s.card?.version}</div>
              <div className="text-sm">Skills: {s.card?.skills?.length}</div>
              <div className="flex flex-wrap gap-1">
                {s.card?.skills?.map((skill: any) => (
                  <Badge key={skill.id} variant="outline" className="text-[10px]">
                    {skill.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {servers.servers?.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No MCP servers bridged yet. POST /v1/mcp/servers to register.
        </div>
      )}
    </div>
  );
}
