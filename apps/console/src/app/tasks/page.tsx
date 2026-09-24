import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import Link from "next/link";

export default async function TasksPage() {
  let data: any = { tasks: [], total: 0 };
  try {
    data = await api.controlPlane.tasks.list({ limit: "100" });
  } catch {}

  const stateColor: Record<string, any> = {
    SUBMITTED: "secondary",
    WORKING: "default",
    COMPLETED: "default",
    FAILED: "destructive",
    CANCELED: "outline",
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tasks</h1>
      <p className="text-sm text-muted-foreground">
        Total: {data.total} • Lifecycle: SUBMITTED → WORKING → COMPLETED/FAILED • Delegation Tree +
        Streaming
      </p>

      <div className="space-y-2">
        {data.tasks?.map((task: any) => (
          <Card key={task.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex justify-between">
                <Link href={`/tasks/${task.id}`} className="hover:underline">
                  {task.id}
                </Link>
                <Badge variant={stateColor[task.state] ?? "outline"}>{task.state}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <div>
                Agent: {task.agentId} • Session: {task.sessionId?.slice(0, 12)} • Context:{" "}
                {task.contextId?.slice(0, 12)}
              </div>
              <div>
                Trace: {task.traceId?.slice(0, 12)} • Root: {task.rootTaskId?.slice(0, 12)} •
                Parent: {task.parentTaskId?.slice(0, 12) ?? "none"}
              </div>
              <div>
                Created: {task.createdAt} • Attempts: {task.attempts}/{task.maxAttempts}
              </div>
              <div className="text-muted-foreground truncate">
                Input: {JSON.stringify(task.input)?.slice(0, 200)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.tasks?.length === 0 && (
        <div className="text-sm text-muted-foreground">No tasks yet. Create via POST /v1/tasks</div>
      )}
    </div>
  );
}
