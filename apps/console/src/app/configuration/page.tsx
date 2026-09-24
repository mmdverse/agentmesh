export default function ConfigurationPage() {
  return (
    <div className="space-y-8">
      <div><div className="modern-label text-black/30">CONFIG • ENV • LIMITS • 12</div><h1 className="modern-display text-[32px] mt-2">CONFIGURATION</h1><div className="modern-mono text-[11px] text-black/50 mt-2">GATEWAY 3001 • CONTROL PLANE 3002 • INFRA POSTGRES REDIS NATS MINIO</div></div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-4 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">GATEWAY</div>
          <div className="mt-4 space-y-3 modern-mono text-[11px]">
            <div className="flex justify-between"><span className="text-black/40">PORT</span><span>3001</span></div>
            <div className="flex justify-between"><span className="text-black/40">HOST</span><span>0.0.0.0</span></div>
            <div className="flex justify-between"><span className="text-black/40">MAX MESSAGE</span><span>1MB</span></div>
            <div className="flex justify-between"><span className="text-black/40">MAX ARTIFACT</span><span>100MB</span></div>
            <div className="flex justify-between"><span className="text-black/40">MAX CONCURRENT</span><span>100</span></div>
            <div className="flex justify-between"><span className="text-black/40">MAX FANOUT</span><span>10</span></div>
            <div className="pt-2 border-t border-black/5"><div className="text-[10px] text-black/30">RATE LIMIT</div><div className="mt-1 text-[10px]">global 1000/s • ip 100/s • org 500/s • project 200/s • agent 50/s</div></div>
          </div>
        </div>
        <div className="md:col-span-4 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">CONTROL PLANE</div>
          <div className="mt-4 space-y-3 modern-mono text-[11px]">
            <div className="flex justify-between"><span className="text-white/40">PORT</span><span>3002</span></div>
            <div className="flex justify-between"><span className="text-white/40">HOST</span><span>0.0.0.0</span></div>
            <div className="flex justify-between"><span className="text-white/40">TASK TIMEOUT</span><span>30m</span></div>
            <div className="flex justify-between"><span className="text-white/40">HEARTBEAT</span><span>30s</span></div>
            <div className="flex justify-between"><span className="text-white/40">TTL</span><span>120s</span></div>
            <div className="pt-2 border-t border-white/10"><div className="text-[10px] text-white/30">CIRCUIT BREAKER</div><div className="mt-1 text-[10px] text-white/60">failureThreshold 5 • timeout 60s • HALF_OPEN trial</div></div>
          </div>
        </div>
        <div className="md:col-span-4 rounded-[20px] bg-[#fafafa] border border-black/10 p-7">
          <div className="modern-label text-black/30">INFRA</div>
          <div className="mt-4 space-y-2 modern-mono text-[10px]">
            <div className="rounded-xl bg-white border border-black/5 p-3"><span className="text-black/30">DB</span> postgresql://agentmesh:***@localhost:5432/agentmesh</div>
            <div className="rounded-xl bg-white border border-black/5 p-3"><span className="text-black/30">REDIS</span> redis://localhost:6379</div>
            <div className="rounded-xl bg-white border border-black/5 p-3"><span className="text-black/30">NATS</span> nats://localhost:4222</div>
            <div className="rounded-xl bg-white border border-black/5 p-3"><span className="text-black/30">S3</span> http://localhost:9000 (MinIO)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
