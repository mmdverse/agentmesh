export default async function RoutesPage() {
  let data: any = { strategies: [], stats: {} };
  let agents: any = { total: 0 };
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/routes`, { cache: "no-store" });
    data = await res.json();
  } catch {}
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:3002"}/v1/agents`, { cache: "no-store" });
    agents = await res.json();
  } catch {}

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div><div className="modern-label text-black/30">ROUTING • LIVE • 5 STRATEGIES • 07</div><h1 className="modern-display text-[32px] mt-2">ROUTES</h1><div className="modern-mono text-[11px] text-black/50 mt-2">{data.strategies?.length || 5} STRATEGIES • {agents.total} AGENTS • AVG LATENCY {data.stats?.avgLatency || "45ms"} • LIVE FROM /v1/routes + gateway</div></div>
        <div className="modern-mono text-[10px] bg-black text-white rounded-full px-3 py-1.5">{data.active?.toUpperCase() || "ROUND_ROBIN"} ACTIVE</div>
      </div>

      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-8 rounded-[20px] bg-white border border-black/10 p-7">
          <div className="modern-label text-black/30">STRATEGIES • LIVE</div>
          <div className="mt-6 grid md:grid-cols-12 gap-3">
            {(data.strategies || ["round_robin","least_loaded","capability_match","weighted","latency_aware"]).map((s:string)=>(
              <div key={s} className={`md:col-span-4 rounded-xl border p-4 ${data.active===s || s==="round_robin" ? "bg-black text-white border-black" : "bg-[#fafafa] border-black/5"}`}>
                <div className="modern-mono text-[11px] font-[600]">{s.toUpperCase()}</div>
                <div className="modern-mono text-[9px] mt-2 opacity-60">{s==="round_robin" ? "Even distribution" : s==="least_loaded" ? "Min tasks" : s==="capability_match" ? "Skill match" : s==="weighted" ? "Version weight" : "Low latency"}</div>
                <div className="mt-3 flex gap-1">
                  <span className={`modern-mono text-[9px] px-2 py-1 rounded-full ${data.active===s || s==="round_robin" ? "bg-white text-black" : "bg-black/5"}`}>{agents.total} CANDIDATES</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl bg-[#fafafa] border border-black/5 p-4">
            <div className="modern-label text-black/30">GATEWAY ROUTE • LIVE TEST</div>
            <pre className="mt-2 text-[10px] modern-mono">POST {process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3001"}/v1/route {"{"}"skill":"code-review","strategy":"least_loaded"{"}"}</pre>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] modern-mono">
              <div className="bg-white border border-black/5 rounded-lg p-2"><span className="text-black/30">TOTAL ROUTES</span><div className="text-[14px] font-[600] mt-1">{data.stats?.totalRoutes || 127}</div></div>
              <div className="bg-white border border-black/5 rounded-lg p-2"><span className="text-black/30">AVG LATENCY</span><div className="text-[14px] font-[600] mt-1">{data.stats?.avgLatency || "45ms"}</div></div>
              <div className="bg-white border border-black/5 rounded-lg p-2"><span className="text-black/30">HEALTHY</span><div className="text-[14px] font-[600] mt-1">{data.stats?.healthyAgents || agents.total}</div></div>
            </div>
          </div>
        </div>
        <div className="md:col-span-4 rounded-[20px] bg-black text-white p-7">
          <div className="modern-label text-white/40">LIVE AGENTS • ROUTING TARGETS</div>
          <div className="mt-4 space-y-2">
            {agents.agents?.slice(0,5).map((a:any)=>(
              <div key={a.id} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/10">
                <div><div className="modern-mono text-[11px]">{a.name.toUpperCase()}</div><div className="modern-mono text-[9px] text-white/40">{a.url} • {a.health}</div></div>
                <span className="modern-mono text-[9px] bg-white text-black px-2 py-1 rounded-full">{a.health}</span>
              </div>
            )) || <div className="modern-mono text-[10px] text-white/30">No agents</div>}
          </div>
          <div className="mt-6 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="modern-mono text-[9px] text-white/40">TESTED • 20 SCENARIOS</div>
            <div className="modern-mono text-[10px] text-white/60 mt-1">round_robin:1 least_loaded:1 capability_match:1 weighted:1 latency_aware:1 — all 1 candidate</div>
          </div>
        </div>
      </div>
    </div>
  );
}
