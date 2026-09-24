import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

export default async function SkillsPage() {
  let agents: any = { agents: [] };
  try {
    agents = await api.controlPlane.agents.list({ limit: "100" });
  } catch {}

  const skillMap = new Map<string, { count: number; agents: string[]; description?: string }>();
  for (const agent of (agents.agents ?? []) as any[]) {
    for (const skill of (agent.skills ?? []) as any[]) {
      const existing = skillMap.get(skill.skillId) ?? {
        count: 0,
        agents: [] as string[],
        description: skill.description,
      };
      existing.count++;
      existing.agents.push(agent.name);
      skillMap.set(skill.skillId, existing);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Skills</h1>
      <p className="text-sm text-muted-foreground">
        Capability Discovery • Agents discoverable by skill
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from(skillMap.entries()).map(([skillId, info]) => (
          <Card key={skillId}>
            <CardHeader>
              <CardTitle className="text-sm">{skillId}</CardTitle>
              <div className="text-xs text-muted-foreground">
                {info.description ?? "No description"}
              </div>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <div>Agents: {info.count}</div>
              <div className="flex flex-wrap gap-1">
                {info.agents.map(a => (
                  <Badge key={a} variant="outline" className="text-[10px]">
                    {a}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {skillMap.size === 0 && (
        <div className="text-sm text-muted-foreground">No skills discovered yet.</div>
      )}
    </div>
  );
}
