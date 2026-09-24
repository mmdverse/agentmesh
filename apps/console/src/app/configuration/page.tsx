import { api } from "@/lib/api";

export default async function ConfigurationPage() {
  let config: any = {};
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/configuration`, { cache: "no-store" });
    config = await res.json();
  } catch {}

  const safeSlice = (v:any, len=80) => {
    if (typeof v === 'string') return v.slice(0,len);
    if (v) return JSON.stringify(v).slice(0,len);
    return null;
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div><div className="modern-label text-black/30">CONFIG • LIVE • ENV • LIMITS • 12</div><h1 className="modern-display text-[32px] mt-2">CONFIGURATION</h1><div className="modern-mono text-[11px] text-black/50 mt-2">GATEWAY 3001 • CONTROL PLANE 3002 • INFRA POSTGRES REDIS NATS MINIO • LIVE FROM /v1/configuration</div></div>
        <div className="modern-mono text-[10px] bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-full">{(config.mode || "DEVELOPMENT").toString().toUpperCase()} • INMEMORY WARNING ACTIVE</div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-4 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">GATEWAY • LIVE</div>
          <div className="mt-4 space-y-3 modern-mono text-[11px]">
            <div className="flex justify-between"><span className="text-black/40">PORT</span><span>{config.gateway?.port || 3001}</span></div>
            <div className="flex justify-between"><span className="text-black/40">HOST</span><span>{config.gateway?.host || "0.0.0.0"}</span></div>
            <div className="flex justify-between"><span className="text-black/40">MAX MESSAGE</span><span>{config.gateway?.maxMessageSize || "1MB"}</span></div>
            <div className="flex justify-between"><span className="text-black/40">MAX ARTIFACT</span><span>{config.gateway?.maxArtifactSize || "100MB"}</span></div>
            <div className="flex justify-between"><span className="text-black/40">MAX CONCURRENT</span><span>{config.gateway?.maxConcurrent || 100}</span></div>
            <div className="flex justify-between"><span className="text-black/40">MAX FANOUT</span><span>{config.gateway?.maxFanout || 10}</span></div>
            <div className="pt-2 border-t border-black/5"><div className="text-[10px] text-black/30">RATE LIMIT • LIVE</div><div className="mt-1 text-[10px]">{config.gateway?.rateLimit ? Object.entries(config.gateway.rateLimit).map(([k,v]:any)=>`${k} ${v}`).join(" • ") : "global 1000/s • ip 100/s • org 500/s • project 200/s • agent 50/s"}</div></div>
          </div>
          <pre className="mt-4 bg-[#fafafa] border border-black/5 rounded-xl p-3 text-[10px] modern-mono max-h-40 overflow-auto">{JSON.stringify(config.gateway || {}, null, 2).slice(0,800)}</pre>
        </div>
        <div className="md:col-span-4 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">CONTROL PLANE • LIVE</div>
          <div className="mt-4 space-y-3 modern-mono text-[11px]">
            <div className="flex justify-between"><span className="text-white/40">PORT</span><span>{config.controlPlane?.port || 3002}</span></div>
            <div className="flex justify-between"><span className="text-white/40">HOST</span><span>{config.controlPlane?.host || "0.0.0.0"}</span></div>
            <div className="flex justify-between"><span className="text-white/40">TASK TIMEOUT</span><span>{config.controlPlane?.taskTimeout || "30m"}</span></div>
            <div className="flex justify-between"><span className="text-white/40">HEARTBEAT</span><span>{config.controlPlane?.heartbeatInterval || "10s dev / 30s prod"}</span></div>
            <div className="flex justify-between"><span className="text-white/40">TTL</span><span>{config.controlPlane?.ttl || "60s dev / 120s prod"}</span></div>
            <div className="pt-2 border-t border-white/10"><div className="text-[10px] text-white/30">CIRCUIT BREAKER • LIVE</div><div className="mt-1 text-[10px] text-white/60">failureThreshold {config.controlPlane?.circuitBreaker?.failureThreshold || 5} • timeout {config.controlPlane?.circuitBreaker?.timeout || "60s"} • HALF_OPEN trial</div></div>
          </div>
          <pre className="mt-4 bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] modern-mono text-white/60 max-h-40 overflow-auto">{JSON.stringify(config.controlPlane || {}, null, 2).slice(0,800)}</pre>
        </div>
        <div className="md:col-span-4 rounded-[20px] bg-[#fafafa] border border-black/10 p-7">
          <div className="modern-label text-black/30">INFRA • LIVE • INMEMORY WARNING</div>
          <div className="mt-4 space-y-2 modern-mono text-[10px]">
            <div className="rounded-xl bg-white border border-black/5 p-3"><span className="text-black/30">DB</span> {safeSlice(config.infra?.postgres) || "postgresql://... (InMemory fallback)"}</div>
            <div className="rounded-xl bg-white border border-black/5 p-3"><span className="text-black/30">REDIS</span> {safeSlice(config.infra?.redis) || "redis://localhost:6379 (InMemory fallback)"}</div>
            <div className="rounded-xl bg-white border border-black/5 p-3"><span className="text-black/30">NATS</span> {safeSlice(config.infra?.nats) || "nats://localhost:4222 (InMemory fallback)"}</div>
            <div className="rounded-xl bg-white border border-black/5 p-3"><span className="text-black/30">S3</span> {safeSlice(config.infra?.s3) || "http://localhost:9000 MinIO (InMemory)"}</div>
          </div>
          <div className="mt-4 p-3 rounded-xl bg-[#fffbeb] border border-amber-200">
            <div className="modern-mono text-[10px] text-black/60">{config.persistence?.warning || "InMemory mode — data will be lost on restart. Use docker-compose up for persistence."}</div>
            <div className="mt-2 flex gap-1">
              <span className={`modern-mono text-[9px] px-2 py-1 rounded-full ${config.persistence?.postgres ? "bg-black text-white" : "bg-black/10"}`}>POSTGRES {config.persistence?.postgres ? "ON" : "OFF"}</span>
              <span className="modern-mono text-[9px] bg-black/10 px-2 py-1 rounded-full">REDIS OFF</span>
              <span className="modern-mono text-[9px] bg-black/10 px-2 py-1 rounded-full">NATS OFF</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[20px] bg-white border border-black/10 p-6">
        <div className="modern-label text-black/30">LIVE CONFIG JSON • /v1/configuration</div>
        <pre className="mt-4 bg-black text-white/70 rounded-xl p-4 text-[10px] modern-mono overflow-auto max-h-80">{JSON.stringify(config || {}, null, 2).slice(0,3000)}</pre>
      </div>
    </div>
  );
}
