import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import Link from "next/link";

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  let task: any = null;
  let history: any = [];
  let graph: any = null;
  try {
    const res = await api.controlPlane.tasks.get(params.id);
    task = res.task;
  } catch {}
  try {
    const res = await api.controlPlane.tasks.history(params.id);
    history = res.history;
  } catch {}
  try {
    const res = await api.controlPlane.tasks.graph(params.id);
    graph = res.graph;
  } catch {}

  if (!task) return <div>Task not found: {params.id}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Task {task.id.slice(0, 16)}...</h1>
        <Badge>{task.state}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>ID: {task.id}</div>
            <div>Root: {task.rootTaskId}</div>
            <div>Parent: {task.parentTaskId ?? "none"}</div>
            <div>
              Agent:{" "}
              <Link href={`/agents/${task.agentId}`} className="underline">
                {task.agentId}
              </Link>
            </div>
            <div>Session: {task.sessionId}</div>
            <div>Context: {task.contextId}</div>
            <div>
              Trace:{" "}
              <Link href={`/telemetry?traceId=${task.traceId}`} className="underline">
                {task.traceId}
              </Link>
            </div>
            <div>
              Org: {task.organizationId ?? "none"} • Project: {task.projectId ?? "none"}
            </div>
            <div>Created: {task.createdAt}</div>
            <div>Updated: {task.updatedAt}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Input / Output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="font-medium text-xs">Input:</div>
              <pre className="text-xs bg-secondary p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(task.input, null, 2)}
              </pre>
            </div>
            {task.output && (
              <div>
                <div className="font-medium text-xs">Output:</div>
                <pre className="text-xs bg-secondary p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(task.output, null, 2)}
                </pre>
              </div>
            )}
            {task.error && (
              <div>
                <div className="font-medium text-xs text-red-500">Error:</div>
                <pre className="text-xs bg-red-50 p-2 rounded overflow-auto">
                  {JSON.stringify(task.error, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {history.map((h: any) => (
              <div key={h.id} className="text-xs flex gap-2 border-b py-1">
                <span>{h.createdAt}</span>
                <Badge variant="outline" className="text-[10px]">
                  {h.fromState ?? "none"} → {h.toState}
                </Badge>
                <span className="text-muted-foreground">{h.reason}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {graph && (
        <Card>
          <CardHeader>
            <CardTitle>Delegation Graph</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs">
              Nodes: {graph.nodes?.length ?? 0} • Edges: {graph.edges?.length ?? 0}
            </div>
            <pre className="text-xs bg-secondary p-2 rounded mt-2 overflow-auto max-h-64">
              {JSON.stringify(graph, null, 2)}
            </pre>
            <Link href={`/tasks/${params.id}/graph`} className="text-xs underline mt-2 block">
              View Live Graph →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
