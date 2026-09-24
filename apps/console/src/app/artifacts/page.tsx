import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

export default async function ArtifactsPage() {
  let data: any = { artifacts: [], total: 0 };
  try {
    data = await api.controlPlane.artifacts.list({ limit: "100" });
  } catch {}

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Artifacts</h1>
      <p className="text-sm text-muted-foreground">
        S3-Compatible Storage • Checksum, Retention, Access Control
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.artifacts?.map((art: any) => (
          <Card key={art.id}>
            <CardHeader>
              <CardTitle className="text-sm">{art.name ?? art.id.slice(0, 16)}</CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline">{art.contentType}</Badge>
                <Badge variant="secondary">{(art.size / 1024).toFixed(1)} KB</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <div>ID: {art.id.slice(0, 20)}...</div>
              <div>Checksum: {art.checksum?.slice(0, 16)}...</div>
              <div>
                Bucket: {art.storageBucket} • Key: {art.storageKey.slice(0, 40)}...
              </div>
              <div>
                Task: {art.taskId?.slice(0, 12) ?? "none"} • Agent:{" "}
                {art.agentId?.slice(0, 12) ?? "none"}
              </div>
              <div>
                Access: {art.accessControl} • Retention: {art.retentionDays ?? "none"} days
              </div>
              <div>Created: {art.createdAt}</div>
              {art.expiresAt && <div>Expires: {art.expiresAt}</div>}
              <div className="flex gap-1 flex-wrap">
                {art.tags?.map((t: string) => (
                  <Badge key={t} variant="outline" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.artifacts?.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No artifacts yet. Create via POST /v1/artifacts
        </div>
      )}
    </div>
  );
}
