import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

export default async function MessagesPage() {
  let data: any = { messages: [], total: 0 };
  try {
    data = await api.controlPlane.messages.list({ limit: "100" });
  } catch {}

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Messages</h1>
      <p className="text-sm text-muted-foreground">Message Router • Sync/Async/Streaming • Trace propagation</p>

      <div className="space-y-2">
        {data.messages?.map((msg: any) => (
          <Card key={msg.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex justify-between">
                <span>{msg.sender} → {msg.receiver}</span>
                <Badge variant="outline">{msg.contentType}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <div>ID: {msg.id} • Task: {msg.taskId?.slice(0, 12) ?? "none"} • Trace: {msg.traceId?.slice(0, 12)}</div>
              <div>Correlation: {msg.correlationId?.slice(0, 12)} • Context: {msg.contextId?.slice(0, 12) ?? "none"}</div>
              <pre className="bg-secondary p-2 rounded overflow-auto max-h-20">{JSON.stringify(msg.content, null, 2).slice(0, 300)}</pre>
              <div className="text-muted-foreground">{msg.timestamp}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.messages?.length === 0 && <div className="text-sm text-muted-foreground">No messages yet.</div>}
    </div>
  );
}
